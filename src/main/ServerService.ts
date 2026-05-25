import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { DatabaseService } from './DatabaseService';
import { app as electronApp } from 'electron';

export class ServerService {
  private app: express.Application;
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private dbService: DatabaseService;
  private actions: {
    syncAudible: () => Promise<any>;
    scanNas: () => Promise<any>;
    scanAzure: () => Promise<any>;
    getQueueSnapshot: () => { queuePaused: boolean; items: Array<{ bookId: string; status: 'queued' | 'downloading' | 'converting'; progress: number; phase?: 'download' | 'convert'; addedAt: number }> };
    toggleIgnore: (id: string) => boolean;
    downloadBook: (id: string) => Promise<any>;
    downloadMany: (ids: string[]) => Promise<any>;
    cancelDownload: (id: string) => boolean;
    login: (region: string) => Promise<any>;
    deleteAccount: (id: string) => Promise<void>;
  };
  private notifyDesktop: () => void;

  constructor(
    dbService: DatabaseService,
    actions: {
      syncAudible: () => Promise<any>;
      scanNas: () => Promise<any>;
      scanAzure: () => Promise<any>;
      getQueueSnapshot: () => { queuePaused: boolean; items: Array<{ bookId: string; status: 'queued' | 'downloading' | 'converting'; progress: number; phase?: 'download' | 'convert'; addedAt: number }> };
      toggleIgnore: (id: string) => boolean;
      downloadBook: (id: string) => Promise<any>;
      downloadMany: (ids: string[]) => Promise<any>;
      cancelDownload: (id: string) => boolean;
      login: (region: string) => Promise<any>;
      deleteAccount: (id: string) => Promise<void>;
    },
    notifyDesktop: () => void = () => {}
  ) {
    this.dbService = dbService;
    this.actions = actions;
    this.notifyDesktop = notifyDesktop;
    this.app = express();
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // Middleware for logging all requests
    this.app.use((req, res, next) => {
      console.log(`[Companion API] ${req.method} ${req.path}`);
      next();
    });

    // Public Health Check (No Auth Required)
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', message: 'BookSync Companion API is reachable' });
    });

    // Middleware for API Key Auth
    this.app.use((req, res, next) => {
      const apiKey = this.dbService.getSetting('mobileServerApiKey', '');
      const authHeader = req.headers.authorization;

      if (!apiKey) {
        console.error('[Companion API] Auth Error: API Key not configured in settings');
        return res.status(500).json({ error: 'API Key not configured on server.' });
      }

      // Check if it's the expected Bearer token
      if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
        console.error(`[Companion API] Auth Error: Invalid token. Received: ${authHeader ? 'incorrect' : 'missing'}`);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });

    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'ok',
        version: electronApp.getVersion(),
        platform: process.platform,
      });
    });

    this.app.get('/api/books', (req, res) => {
      try {
        const books = this.dbService.getBooks();
        const allDetails = this.dbService.getAllBookDetails();
        
        // Merge metadata into book objects for efficient mobile filtering
        const booksWithMetadata = books.map(book => {
          const details = allDetails[book.id];
          return {
            ...book,
            categories: details?.categories || [],
            publisher: details?.publisher || book.publisher || null,
            narrator: book.narrator || null
          };
        });

        const ignoredCount = booksWithMetadata.filter(b => b.isIgnored).length;
        console.log(`[Companion API] GET /api/books - Total: ${booksWithMetadata.length}, Ignored: ${ignoredCount}`);
        res.json(booksWithMetadata);
      } catch (err: any) {
        console.error('[Companion API] GET /api/books failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/books/:id/details', (req, res) => {
      try {
        const details = this.dbService.getBookDetails(req.params.id);
        res.json(details);
      } catch (err: any) {
        console.error(`[Companion API] GET /api/books/${req.params.id}/details failed:`, err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/downloads/status', (req, res) => {
      try {
        res.json(this.actions.getQueueSnapshot());
      } catch (err: any) {
        console.error('[Companion API] GET /api/downloads/status failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/logs', (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const logs = this.dbService.getLogs(limit);
        res.json(logs);
      } catch (err: any) {
        console.error('[Companion API] GET /api/logs failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.delete('/api/logs', (req, res) => {
      try {
        this.dbService.clearLogs();
        console.log('[Companion API] DELETE /api/logs - Logs cleared');
        res.json({ success: true });
      } catch (err: any) {
        console.error('[Companion API] DELETE /api/logs failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/actions/sync-audible', async (req, res) => {
      try {
        const result = await this.actions.syncAudible();
        this.notifyDesktop();
        res.json({ success: true, data: result });
      } catch (err: any) {
        console.error('[Companion API] POST /api/actions/sync-audible failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/actions/scan-nas', async (req, res) => {
      try {
        const result = await this.actions.scanNas();
        this.notifyDesktop();
        res.json({ success: true, data: result });
      } catch (err: any) {
        console.error('[Companion API] POST /api/actions/scan-nas failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/actions/scan-azure', async (req, res) => {
      try {
        const result = await this.actions.scanAzure();
        this.notifyDesktop();
        res.json({ success: true, data: result });
      } catch (err: any) {
        console.error('[Companion API] POST /api/actions/scan-azure failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/actions/download/:id', async (req, res) => {
      try {
        console.log(`[Companion API] Triggering download for book: ${req.params.id}`);
        const result = await this.actions.downloadBook(req.params.id);
        res.json({ success: true, data: result });
      } catch (err: any) {
        console.error(`[Companion API] POST /api/actions/download/${req.params.id} failed:`, err);
        res.status(500).json({ error: err.message, stack: err.stack });
      }
    });

    this.app.post('/api/actions/download-bulk', async (req, res) => {
      try {
        const { bookIds } = req.body;
        console.log('[Companion API] POST /api/actions/download-bulk - Request Body:', JSON.stringify(req.body));
        
        if (!bookIds || !Array.isArray(bookIds)) {
          console.error('[Companion API] download-bulk error: bookIds missing or not an array', req.body);
          throw new Error('bookIds must be an array');
        }
        
        console.log(`[Companion API] Queueing ${bookIds.length} books for download`);
        const result = await this.actions.downloadMany(bookIds);
        res.json({ success: true, count: bookIds.length, data: result });
      } catch (err: any) {
        console.error('[Companion API] POST /api/actions/download-bulk FAILED:', err);
        res.status(500).json({ 
          error: err.message, 
          stack: err.stack,
          receivedBody: req.body 
        });
      }
    });

    this.app.post('/api/books/:id/toggle-ignore', (req, res) => {
      try {
        const isIgnored = this.actions.toggleIgnore(req.params.id);
        console.log(`[Companion API] POST /api/books/${req.params.id}/toggle-ignore - Result: ${isIgnored}`);
        this.broadcast('library:updated', { source: 'toggle-ignore', bookId: req.params.id, isIgnored });
        this.notifyDesktop();
        res.json({ success: true, isIgnored });
      } catch (err: any) {
        console.error(`[Companion API] POST /api/books/${req.params.id}/toggle-ignore failed:`, err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.delete('/api/actions/download/:id', (req, res) => {
      try {
        console.log(`[Companion API] Request to cancel download: ${req.params.id}`);
        const cancelled = this.actions.cancelDownload(req.params.id);
        res.json({ success: true, cancelled });
      } catch (err: any) {
        console.error(`[Companion API] DELETE /api/actions/download/${req.params.id} failed:`, err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/settings', (req, res) => {
      try {
        const settings = this.dbService.getAllSettings();
        // Redact sensitive settings
        const safeSettings = settings.map(s => {
          if (s.key.toLowerCase().includes('apikey') || s.key.toLowerCase().includes('password')) {
            return { ...s, value: '[REDACTED]' };
          }
          return s;
        });
        res.json(safeSettings);
      } catch (err: any) {
        console.error('[Companion API] GET /api/settings failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/settings', (req, res) => {
      try {
        const { key, value } = req.body;
        if (!key) throw new Error('Setting key is required');
        this.dbService.setSetting(key, value);
        console.log(`[Companion API] Setting updated: ${key} = ${value}`);
        res.json({ success: true });
      } catch (err: any) {
        console.error('[Companion API] POST /api/settings failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/accounts', (req, res) => {
      try {
        const accounts = this.dbService.getAccounts();
        res.json(accounts);
      } catch (err: any) {
        console.error('[Companion API] GET /api/accounts failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/accounts/login', async (req, res) => {
      try {
        const { region } = req.body;
        console.log(`[Companion API] Login requested for region: ${region}`);
        const result = await this.actions.login(region || 'us');
        res.json(result);
      } catch (err: any) {
        console.error('[Companion API] POST /api/accounts/login failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.delete('/api/accounts/:id', async (req, res) => {
      try {
        const accountId = req.params.id;
        console.log(`[Companion API] Request to delete account: ${accountId}`);
        await this.actions.deleteAccount(accountId);
        res.json({ success: true });
      } catch (err: any) {
        console.error(`[Companion API] DELETE /api/accounts/${req.params.id} failed:`, err);
        res.status(500).json({ error: err.message });
      }
    });
  }

  broadcast(type: string, data: any) {
    if (!this.wss) return;
    const message = JSON.stringify({ type, data });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  start() {
    const enabled = this.dbService.getSetting('mobileServerEnabled', 'false') === 'true';
    if (!enabled) return;

    const port = parseInt(this.dbService.getSetting('mobileServerPort', '3000')) || 3000;
    
    // Ensure API Key exists
    let apiKey = this.dbService.getSetting('mobileServerApiKey', '');
    if (!apiKey) {
      apiKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      this.dbService.setSetting('mobileServerApiKey', apiKey);
    }

    this.server = this.app.listen(port, () => {
      console.log(`[Companion API] Server running on port ${port}`);
    });

    // Initialize WebSocket Server
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws, req) => {
      // Basic auth for WS (via query param)
      const url = new URL(req.url || '', `http://localhost:${port}`);
      const wsKey = url.searchParams.get('apiKey');
      
      if (wsKey !== apiKey) {
        console.error('[Companion WS] Auth Error: Invalid API Key');
        ws.close(4001, 'Unauthorized');
        return;
      }

      console.log('[Companion WS] Client connected');
      
      ws.on('close', () => {
        console.log('[Companion WS] Client disconnected');
      });
    });
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('[Companion API] Server stopped');
    }
  }

  restart() {
    this.stop();
    this.start();
  }
}
