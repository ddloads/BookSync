import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { parseIsoDuration } from './audibleUtils';
import { getAppPath, isPackagedApp } from './runtime';

type WrapperProgress = {
  stage?: string
  page?: number
  pageTotal?: number | null
  itemsFetched?: number
  pageItems?: number
  message?: string
}

type SyncedBookResult = {
  book: any
  details: any
}

export class AudibleService {
  private getWrapperPath(): string {
    const appPath = getAppPath();
    const isDev = !isPackagedApp();
    if (process.platform === 'win32') {
      if (isDev) {
        return path.join(appPath, 'resources', 'audible_wrapper.exe');
      } else {
        return path.join(process.resourcesPath, 'audible_wrapper.exe');
      }
    }
    // On Linux/Docker or if we want to run script directly
    return path.join(appPath, 'src', 'main', 'python', 'audible_wrapper.py');
  }

  private runWrapper(args: string[], onProgress?: (progress: WrapperProgress) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      const wrapperPath = this.getWrapperPath();
      const isPythonScript = wrapperPath.endsWith('.py');
      
      let spawnCmd = isPythonScript ? (process.platform === 'win32' ? 'python' : 'python3') : wrapperPath;
      
      if (isPythonScript) {
        // Try to use venv if it exists
        const venvPath = path.join(getAppPath(), 'src', 'main', 'python', 'venv', 
          process.platform === 'win32' ? 'Scripts' : 'bin',
          process.platform === 'win32' ? 'python.exe' : 'python3');
        
        if (fs.existsSync(venvPath)) {
          spawnCmd = venvPath;
        }
      }

      const spawnArgs = isPythonScript ? [wrapperPath, ...args] : args;

      if (!isPythonScript && !fs.existsSync(wrapperPath)) {
        return reject(new Error(`Audible wrapper not found at: ${wrapperPath}`));
      }

      const child = spawn(spawnCmd, spawnArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      let stderrBuffer = ''

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk
      })

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk
        stderrBuffer += chunk

        const lines = stderrBuffer.split(/\r?\n/)
        stderrBuffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('BOOKSYNC_PROGRESS ')) continue
          try {
            const payload = JSON.parse(line.slice('BOOKSYNC_PROGRESS '.length))
            onProgress?.(payload)
          } catch {
            // Ignore malformed progress messages and keep processing.
          }
        }
      })

      child.on('error', (error) => {
        reject(new Error(`Wrapper error: ${error.message}`))
      })

      child.on('close', (code) => {
        if (code !== 0) {
          const cleanedStderr = stderr
            .split(/\r?\n/)
            .filter((line) => !line.startsWith('BOOKSYNC_PROGRESS ') && line.trim().length > 0)
            .join('\n')
          return reject(new Error(`Wrapper error: ${cleanedStderr || `Process exited with code ${code}`}`))
        }
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            return reject(new Error(result.error));
          }
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse wrapper output: ${stdout}`));
        }
      })
    });
  }

  async getExternalLoginUrl(region: string = 'us'): Promise<{
    oauth_url: string
    serial: string
    code_verifier: string
    domain: string
    locale_code: string
  }> {
    return this.runWrapper(['login_url', '--locale', region]);
  }

  async registerFromExternalLogin(
    responseUrl: string,
    serial: string,
    codeVerifier: string,
    region: string = 'us'
  ): Promise<any> {
    return this.runWrapper([
      'register',
      '--response-url',
      responseUrl,
      '--serial',
      serial,
      '--code-verifier',
      codeVerifier,
      '--locale',
      region
    ]);
  }

  async getLibrary(authData: string, onProgress?: (progress: WrapperProgress) => void): Promise<SyncedBookResult[]> {
    const data = await this.runWrapper(['library', '--auth', authData], onProgress);
    
    // Map audible-cli / python-audible library format to our Book schema
    // python-audible returns a lot of metadata.
    const items = data.items || [];
    return items.map((item: any) => {
      const product = item.product_brief || item;
      const productImages = product.product_images || item.product_images || null
      const categories: string[] = []
      for (const genre of product.category_ladders || item.category_ladders || []) {
        for (const ladder of genre.ladder || []) {
          if (ladder?.name && !categories.includes(ladder.name)) categories.push(ladder.name)
        }
      }
      const coverUrl =
        product.image_url ||
        productImages?.['500'] ||
        productImages?.['252'] ||
        productImages?.['1215'] ||
        productImages?.['315'] ||
        null
      const asin = product.asin
      const details = {
        description: product.extended_product_description || product.publisher_summary || '',
        duration: product.runtime_length_min ? `${product.runtime_length_min} min` : '',
        releaseDate: product.release_date || '',
        publisher: product.publisher_name || '',
        format: product.content_type || product.content_delivery_type || '',
        language: product.language || '',
        rating: null,
        categories,
        copyright: product.copyright || '',
        seriesSequence: product.series?.[0]?.sequence != null ? String(product.series[0].sequence) : '',
        infoLink: `https://www.audible.com/pd/${asin}`
      }

      return {
        book: {
          id: asin,
          title: product.title || 'Unknown Title',
          author: product.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
          narrator: product.narrators?.map((n: any) => n.name).join(', ') || 'Unknown Narrator',
          series: product.series?.map((s: any) => s.title).join(', ') || null,
          seriesSequence: details.seriesSequence || null,
          duration: product.runtime_length_min ? `${product.runtime_length_min} min` : 'Unknown',
          purchaseDate: item.purchase_date || null,
          addedDate: item.library_status?.date_added || item.purchase_date || null,
          coverUrl,
          downloadUrl: null,
          isDownloaded: false
        },
        details
      };
    });
  }

  async getActivationBytes(authData: string): Promise<string> {
    const result = await this.runWrapper(['activation', '--auth', authData]);
    return result.activation_bytes;
  }

  async getDownloadUrl(authData: string, asin: string): Promise<any> {
    return this.runWrapper(['download_url', '--auth', authData, '--asin', asin]);
  }

  /** Keep legacy methods as stubs or refactor them if still needed */
  async validateSession(): Promise<boolean> {
    return true; // Session validation will be handled by the wrapper/auth-data
  }

  async getBookDetails(authData: string, asin: string): Promise<any> {
    return this.runWrapper(['details', '--auth', authData, '--asin', asin]);
  }

  async downloadBook(
    downloadUrl: string,
    outputPath: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    // Current download logic uses a stream from a URL.
    // If we switch to audible-cli for downloads, we'd call the wrapper here.
    // For now, we'll keep the existing download logic in ExportService
    // and just provide it the cookies it needs.
  }
}

