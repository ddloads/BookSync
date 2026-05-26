import { spawn, ChildProcess } from 'child_process';
import originalFfmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

let ffmpegPath = process.env.BOOKSYNC_FFMPEG_PATH || originalFfmpegPath;
if (ffmpegPath && ffmpegPath.includes('app.asar')) {
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}

import os from 'os';
import https from 'https';
import axios from 'axios';
import * as mm from 'music-metadata';
import { sanitize } from './utils';
import { Book, BookDetails } from './types';
import { parseExpectedDurationSeconds } from './exportUtils';
import { AaxCache } from './AaxCache';

const httpsAgent = new https.Agent({ keepAlive: true });

export class ExportService {
  constructor(private readonly aaxCache?: AaxCache) {}

  /**
   * Downloads the encrypted AAX file to disk first, then converts it.
   * This two-step process avoids ffmpeg stdin stream seeking limitations,
   * significantly improving download speed compared to piping.
   */
  async downloadAndConvertStream(
    downloadUrl: string,
    book: Book,
    details: BookDetails | null,
    nasPath: string,
    activationBytes: string,
    cookies: string,
    onProgress?: (data: { progress: number; speed?: number; phase?: 'download' | 'convert' }) => void,
    onLog?: (type: 'info' | 'success' | 'error', title: string, message: string) => void,
    onFfmpeg?: (ffmpeg: ChildProcess) => void,
    signal?: AbortSignal,
    targetFormat: 'm4b' | 'mp3' = 'm4b',
    audibleSource: {
      audibleFormat?: 'aax' | 'aaxc';
      voucher?: { key: string; iv: string } | null;
    } = {}
  ): Promise<string> {
    const audibleFormat: 'aax' | 'aaxc' = audibleSource.audibleFormat ?? 'aax';
    const voucher = audibleSource.voucher ?? null;
    if (audibleFormat === 'aaxc' && !voucher) {
      throw new Error('Audible returned an AAXC download but no voucher was provided. Cannot decrypt.');
    }
    if (audibleFormat === 'aax' && !activationBytes) {
      throw new Error('Audible returned an AAX download but activation bytes are missing.');
    }
    const log = (type: 'info' | 'success' | 'error', title: string, message: string) => {
      if (onLog) onLog(type, title, message);
    };

    if (!nasPath) throw new Error('NAS path not configured.');
    if (!ffmpegPath) throw new Error('FFmpeg binary not found.');

    const ext = targetFormat.toLowerCase();
    const bookTitle = book.title || 'Unknown Book';
    log('info', 'Download Start', `Initializing ${ext.toUpperCase()} download for "${bookTitle}" (ID: ${book.id})`);

    const authorDir = sanitize(book.author);
    const seriesDir = book.series ? sanitize(book.series) : '';
    const titleDir = sanitize(book.title);

    let targetFolder = path.join(nasPath, authorDir);
    if (seriesDir) {
      targetFolder = path.join(targetFolder, seriesDir);
    }
    targetFolder = path.join(targetFolder, titleDir);

    const targetFile = path.join(targetFolder, `${sanitize(book.title)}.${ext}`);
    const tempFolder = path.join(os.tmpdir(), 'BookSync', 'staging');
    if (!fs.existsSync(tempFolder)) {
      fs.mkdirSync(tempFolder, { recursive: true });
    }
    const sourceExt: 'aax' | 'aaxc' = audibleFormat;
    const tempAaxFile = path.join(tempFolder, `${Date.now()}-${sanitize(book.id || book.title || 'book')}.${sourceExt}`);
    const tempOutputFile = path.join(tempFolder, `${Date.now()}-${sanitize(book.id || book.title || 'book')}.${ext}`);

    // 0. Kick off cover download concurrently — resolved before ffmpeg needs it
    const coverPathResolved = path.join(tempFolder, `cover-${book.id}.jpg`);
    const coverPromise: Promise<string | null> = book.coverUrl
      ? axios.get(book.coverUrl, { responseType: 'arraybuffer', httpsAgent })
          .then(res => fs.promises.writeFile(coverPathResolved, Buffer.from(res.data)).then(() => coverPathResolved))
          .catch(() => null)
      : Promise.resolve(null);

    // --- STEP 1: Fast Download to Disk (skipped if cached) ---
    let aaxSourcePath = tempAaxFile;
    const cachedAaxPath = book.id ? (await this.aaxCache?.get(book.id, sourceExt) ?? null) : null;

    if (cachedAaxPath) {
      aaxSourcePath = cachedAaxPath;
      log('info', 'Download Skipped', `Reusing cached ${sourceExt.toUpperCase()} for "${bookTitle}" (saved an Audible round-trip)`);
      if (onProgress) onProgress({ progress: 100, speed: 0, phase: 'download' });
    } else {
      await new Promise<void>(async (resolve, reject) => {
        let settled = false;

        const cleanupAax = () => {
          if (fs.existsSync(tempAaxFile)) {
            try { fs.unlinkSync(tempAaxFile); } catch {}
          }
        };

        const rejectOnce = (err: Error) => {
          if (settled) return;
          settled = true;
          cleanupAax();
          reject(err);
        };

        if (signal) {
          signal.addEventListener('abort', () => {
            rejectOnce(new Error('Download cancelled'));
          }, { once: true });
        }

        try {
          const response = await axios.get(downloadUrl, {
            responseType: 'stream',
            maxRedirects: 10,
            headers: { 'Cookie': cookies },
            httpsAgent,
            signal
          });

          const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
          const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
          log('info', 'Download Phase', `Connected to Audible. File size: ${totalMb} MB`);

          let downloadedBytes = 0;
          let lastBytes = 0;
          let lastTime = Date.now();
          let currentSpeed = 0;

          const writer = fs.createWriteStream(tempAaxFile);
          response.data.pipe(writer);

          response.data.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            const now = Date.now();
            const delta = now - lastTime;

            if (delta >= 1000) {
              const bytesSinceLast = downloadedBytes - lastBytes;
              currentSpeed = (bytesSinceLast / (delta / 1000));
              lastBytes = downloadedBytes;
              lastTime = now;
            }

            if (totalBytes > 0 && onProgress) {
              const progress = Math.min(Math.round((downloadedBytes / totalBytes) * 100), 100);
              onProgress({ progress, speed: currentSpeed, phase: 'download' });
            }
          });

          writer.on('finish', () => {
            if (settled) return;
            settled = true;
            resolve();
          });

          writer.on('error', (err) => rejectOnce(err));
          response.data.on('error', (err: Error) => rejectOnce(err));
          response.data.on('aborted', () => rejectOnce(new Error('Download stream was interrupted (aborted).')));
        } catch (err: any) {
          rejectOnce(err);
        }
      });

      // Successful download: park the AAX/AAXC in the cache so re-runs
      // (retag, re-faststart, recover from a silent-file failure) skip the
      // long Audible download. After this point aaxSourcePath points at the
      // cache entry.
      if (this.aaxCache && book.id) {
        try {
          aaxSourcePath = await this.aaxCache.put(book.id, tempAaxFile, sourceExt);
        } catch (err: any) {
          log('error', 'AAX Cache', `Failed to cache ${sourceExt.toUpperCase()} for "${bookTitle}": ${err?.message ?? err}`);
          // Fall through; aaxSourcePath stays at tempAaxFile and we'll clean
          // it up below as the legacy code did.
        }
      }
    }

    // --- STEP 2: Fast Local FFmpeg Conversion ---
    const coverPath = await coverPromise;
    return new Promise((resolve, reject) => {
      let settled = false;
      let ffmpegErrorOutput = '';

      // AAX uses a single per-account `-activation_bytes` key; AAXC uses
      // per-title `-audible_key` / `-audible_iv` from the decrypted voucher.
      // Mismatching the flag to the file format gives ffmpeg garbage that the
      // AAC decoder soft-fails into a silent track (the bug that bit
      // Moonstruck) — we hard-fail upstream if the wrong combo is requested.
      const args = ['-y'];
      if (audibleFormat === 'aaxc' && voucher) {
        args.push('-audible_key', voucher.key);
        args.push('-audible_iv', voucher.iv);
      } else {
        args.push('-activation_bytes', activationBytes);
      }
      args.push('-i', aaxSourcePath);

      if (coverPath) {
        args.push('-i', coverPath);
      }

      args.push('-map', '0:a');
      if (coverPath) {
        args.push('-map', '1:v');
        args.push('-c:v', 'copy', '-disposition:v', 'attached_pic');
      }

      // Metadata mapping
      args.push('-metadata', `title=${book.title}`);
      args.push('-metadata', `album=${book.title}`);
      args.push('-metadata', `artist=${book.author}`);
      args.push('-metadata', `album_artist=${book.author}`);
      if (book.series) {
        args.push('-metadata', `grouping=${book.series}`);
        args.push('-metadata', `series=${book.series}`);
      }
      args.push('-metadata', `composer=${book.narrator}`);
      args.push('-metadata', `comment=ASIN:${book.id}`);
      args.push('-metadata', `asin=${book.id}`);

      if (details) {
        if (details.description) args.push('-metadata', `description=${details.description}`);
        if (details.publisher) args.push('-metadata', `publisher=${details.publisher}`);
        if (details.releaseDate) args.push('-metadata', `date=${details.releaseDate}`);
        if (details.language) args.push('-metadata', `language=${details.language}`);
        if (details.seriesSequence) {
          args.push('-metadata', `series-part=${details.seriesSequence}`);
          args.push('-metadata', `track=${details.seriesSequence}`);
        }
        if (details.categories && details.categories.length > 0) {
          args.push('-metadata', `genre=${details.categories.join(', ')}`);
        }
        if (details.copyright) args.push('-metadata', `copyright=${details.copyright}`);
      }

      if (ext === 'm4b') {
        // -movflags +faststart relocates the moov atom to the front of the
        // file at write time. Without it, players have to make a separate
        // Range request to the tail of the file before they can start decoding,
        // adding 2-4s of latency to every cold playback start over the network.
        args.push('-c:a', 'copy', '-movflags', '+faststart', tempOutputFile);
      } else {
        // MP3 requires re-encoding. libmp3lame -q:a 2 is high quality VBR (~190kbps)
        args.push('-c:a', 'libmp3lame', '-q:a', '2', tempOutputFile);
      }

      const ffmpeg = spawn(ffmpegPath!, args);
      if (onFfmpeg) onFfmpeg(ffmpeg);

      let totalSeconds = 0;

      ffmpeg.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        ffmpegErrorOutput += chunk;

        if (onProgress) {
          if (!totalSeconds) {
            const durMatch = ffmpegErrorOutput.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
            if (durMatch) {
              totalSeconds = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]) + parseInt(durMatch[4]) / 100;
            }
          }

          if (totalSeconds > 0) {
            const timeMatch = chunk.match(/time=\s*(\d+):(\d+):(\d+)\.(\d+)/);
            if (timeMatch) {
              const currentSeconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 100;
              const progress = Math.min(Math.round((currentSeconds / totalSeconds) * 100), 100);
              onProgress({ progress, speed: 0, phase: 'convert' });
            }
          }
        }
      });

      const cleanupAll = () => {
        if (!ffmpeg.killed) ffmpeg.kill();
        if (fs.existsSync(tempAaxFile)) { try { fs.unlinkSync(tempAaxFile); } catch {} }
        if (coverPath && fs.existsSync(coverPath)) { try { fs.unlinkSync(coverPath); } catch {} }
      };

      const cleanupTempOutput = () => {
        if (fs.existsSync(tempOutputFile)) { try { fs.unlinkSync(tempOutputFile); } catch {} }
      };

      const rejectOnce = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanupAll();
        cleanupTempOutput();
        reject(err);
      };

      const resolveOnce = (filePath: string) => {
        if (settled) return;
        settled = true;
        cleanupAll();
        resolve(filePath);
      };

      if (signal) {
        signal.addEventListener('abort', () => {
          rejectOnce(new Error('Download cancelled'));
        }, { once: true });
      }

      ffmpeg.on('close', (code: number | null) => {
        if (settled) return;

        if (ffmpeg.killed) {
          rejectOnce(new Error('Download cancelled'));
          return;
        }
        if (code !== 0) {
          rejectOnce(new Error(`FFmpeg failed with code ${code}. Error: ${ffmpegErrorOutput}`));
          return;
        }

        (async () => {
          try {
            await this.validateConvertedFile(tempOutputFile, book.duration);
            await fs.promises.mkdir(targetFolder, { recursive: true });
            await this.moveFileSafe(tempOutputFile, targetFile);
            resolveOnce(targetFile);
          } catch (err: any) {
            rejectOnce(new Error(err?.message || String(err)));
          }
        })();
      });

      ffmpeg.on('error', (err: Error) => {
        rejectOnce(err);
      });
    });
  }

  private async validateConvertedFile(filePath: string, expectedDurationRaw?: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error('Converted file is missing from temporary staging.');
    }

    const stat = fs.statSync(filePath);
    if (stat.size <= 0) {
      throw new Error('Converted file is empty.');
    }

    const metadata = await mm.parseFile(filePath, { duration: true });
    const actualDuration = metadata.format.duration ?? 0;
    if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
      throw new Error('Converted file metadata is invalid (no playable duration).');
    }

    const expectedDuration = parseExpectedDurationSeconds(expectedDurationRaw);
    if (expectedDuration > 0) {
      const tolerance = Math.max(180, expectedDuration * 0.15); // 3 minutes or 15%
      if (actualDuration + tolerance < expectedDuration) {
        throw new Error(
          `Converted file appears incomplete (duration ${Math.round(actualDuration)}s vs expected ${Math.round(expectedDuration)}s).`
        );
      }
    }

    // Sniff a few seconds at three positions to catch the "valid container,
    // silent audio" failure mode caused by wrong activation_bytes (or by
    // Audible serving an AAXC file under the legacy AAX endpoint).
    const silence = await this.detectSilentAudio(filePath, actualDuration);
    if (silence.silent) {
      const sampleDetails = silence.samples
        .map((s) => `t=${Math.round(s.startSec)}s peak=${Number.isFinite(s.maxDb) ? s.maxDb.toFixed(1) : '-inf'}dB`)
        .join(', ');
      throw new Error(
        `Converted file is silent at every sampled position (${sampleDetails}). ` +
        `This almost always means the activation bytes did not actually decrypt the audio — ` +
        `either the bytes are stale for the current Audible account, or Audible served an AAXC ` +
        `file under the legacy AAX endpoint (newer accounts only get AAXC). Re-check the auth ` +
        `for this account; if AAXC is the cause, this title can't be converted with -activation_bytes.`
      );
    }
  }

  /** Runs `ffmpeg -af volumedetect` over a short window and returns the max peak in dB. */
  private getMaxVolumeDb(filePath: string, startSec: number, durationSec: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!ffmpegPath) {
        reject(new Error('FFmpeg binary not found.'));
        return;
      }
      const args = [
        '-nostats',
        '-hide_banner',
        '-ss', String(startSec),
        '-t', String(durationSec),
        '-i', filePath,
        '-vn',
        '-af', 'volumedetect',
        '-f', 'null',
        '-',
      ];
      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => {
        // Treat a non-zero exit as "no measurable signal" rather than a hard
        // error — short trailing windows past the end of the file legitimately
        // produce code != 0 and we don't want a false silent positive there.
        if (code !== 0) {
          resolve(-Infinity);
          return;
        }
        const match = stderr.match(/max_volume:\s*(-?(?:inf|\d+(?:\.\d+)?))\s*dB/);
        if (!match) {
          resolve(-Infinity);
          return;
        }
        const raw = match[1];
        if (raw === '-inf' || raw === 'inf') {
          resolve(-Infinity);
          return;
        }
        resolve(parseFloat(raw));
      });
    });
  }

  /**
   * Picks three short sample windows across the file (early, middle, late) and
   * returns whether the peak level is below -60 dB at every one. Skips the
   * first 30 seconds because some books open with silent intros / credits.
   */
  private async detectSilentAudio(
    filePath: string,
    durationSec: number,
  ): Promise<{ silent: boolean; samples: Array<{ startSec: number; maxDb: number }> }> {
    const SILENCE_THRESHOLD_DB = -60;
    const SAMPLE_LENGTH_SEC = 10;

    const candidatePoints = [
      30,
      durationSec / 2 - SAMPLE_LENGTH_SEC / 2,
      durationSec - SAMPLE_LENGTH_SEC - 60,
    ];
    const samplePoints = candidatePoints.filter(
      (s) => s >= 0 && s + SAMPLE_LENGTH_SEC <= durationSec,
    );
    if (samplePoints.length === 0) {
      return { silent: false, samples: [] };
    }

    const samples = await Promise.all(
      samplePoints.map(async (startSec) => ({
        startSec,
        maxDb: await this.getMaxVolumeDb(filePath, startSec, SAMPLE_LENGTH_SEC),
      })),
    );

    const silent = samples.every(
      (s) => !Number.isFinite(s.maxDb) || s.maxDb < SILENCE_THRESHOLD_DB,
    );
    return { silent, samples };
  }

  private async moveFileSafe(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await fs.promises.rename(sourcePath, targetPath);
      return;
    } catch (err: any) {
      if (err?.code !== 'EXDEV') throw err;
    }

    // Cross-device move (e.g. /tmp -> /downloads on a Docker named volume).
    // CIFS/SMB-backed shares reject same-directory rename of dot-prefixed
    // partials with EACCES, so don't bother staging — copy straight to the
    // final path. copyFile opens with O_TRUNC, so it overwrites any leftover
    // target from a prior failed attempt.
    try {
      await fs.promises.copyFile(sourcePath, targetPath);
    } catch (copyErr) {
      try {
        await fs.promises.unlink(targetPath);
      } catch {}
      throw copyErr;
    }
    await fs.promises.unlink(sourcePath);
  }

}
