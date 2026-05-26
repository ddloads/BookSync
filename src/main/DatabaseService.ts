import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { Book, BookDetails, LogEntry } from './types';
import { BookSchema, BookDetailsSchema } from '../shared/schemas';
import { safeParseJSON, safeValidate } from '../shared/validate';
import { mergeBooksForSave } from './bookPersistence';
import { getUserDataPath } from './runtime';

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(getUserDataPath(), 'booksync.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
    this.migrateFromJson();
    this.migratePurchaseDate();
    this.migrateLegacyPurchaseDateField();
    this.migrateBookSyncState();
  }

  private migratePurchaseDate() {
    const rows = this.db.prepare('SELECT id, data FROM books').all() as { id: string; data: string }[];
    const update = this.db.prepare('UPDATE books SET data = ? WHERE id = ?');

    this.db.transaction(() => {
      for (const row of rows) {
        const book = safeParseJSON(row.data, BookSchema, 'migratePurchaseDate');
        if ((book as any).purchaseDate && !book.addedDate) {
          (book as any).addedDate = (book as any).purchaseDate;
          delete (book as any).purchaseDate;
          update.run(JSON.stringify(book), row.id);
        }
      }
    })();
  }

  private migrateLegacyPurchaseDateField() {
    const rows = this.db.prepare('SELECT id, data FROM books').all() as { id: string; data: string }[];
    const update = this.db.prepare('UPDATE books SET data = ? WHERE id = ?');

    this.db.transaction(() => {
      for (const row of rows) {
        const book = safeParseJSON(row.data, BookSchema, 'migrateLegacyPurchaseDateField') as any;
        if (!book.purchaseDate && book.addedDate) {
          book.purchaseDate = book.addedDate;
          update.run(JSON.stringify(book), row.id);
        }
      }
    })();
  }

  private migrateBookSyncState() {
    const rows = this.db.prepare('SELECT id, data FROM books').all() as { id: string; data: string }[];
    const update = this.db.prepare('UPDATE books SET data = ? WHERE id = ?');

    this.db.transaction(() => {
      for (const row of rows) {
        const book = safeParseJSON(row.data, BookSchema, 'migrateBookSyncState') as any;
        let changed = false;

        if (typeof book.isInAbs !== 'boolean') {
          book.isInAbs = false;
          changed = true;
        }
        if (typeof book.azureHasSilent !== 'boolean') {
          book.azureHasSilent = false;
          changed = true;
        }
        if (book.lastAbsConfirmedAt === undefined) {
          book.lastAbsConfirmedAt = null;
          changed = true;
        }

        if (changed) {
          update.run(JSON.stringify(book), row.id);
        }
      }
    })();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS book_details (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        region TEXT NOT NULL,
        auth_data TEXT NOT NULL,
        last_sync DATETIME
      );
    `);
  }

  // --- Accounts ---
  saveAccount(id: string, name: string, region: string, authData: string) {
    this.db.prepare('INSERT OR REPLACE INTO accounts (id, name, region, auth_data) VALUES (?, ?, ?, ?)')
      .run(id, name, region, authData);
  }

  getAccounts(): any[] {
    return this.db.prepare('SELECT * FROM accounts').all();
  }

  getAccount(id: string): any {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  }

  deleteAccount(id: string) {
    this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    // Optionally delete books associated with this account
  }

  updateAccountSyncTime(id: string) {
    this.db.prepare('UPDATE accounts SET last_sync = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }


  // One-time migration: import db.json from userData if it exists
  private migrateFromJson() {
    const jsonPath = path.join(getUserDataPath(), 'db.json');
    if (!fs.existsSync(jsonPath)) return;

    const booksCount = (this.db.prepare('SELECT COUNT(*) as n FROM books').get() as { n: number }).n;
    if (booksCount > 0) {
      fs.renameSync(jsonPath, jsonPath + '.migrated');
      return;
    }

    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      const insertBook = this.db.prepare('INSERT OR REPLACE INTO books (id, data) VALUES (?, ?)');
      const insertSetting = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      const insertDetail = this.db.prepare('INSERT OR REPLACE INTO book_details (id, data) VALUES (?, ?)');

      const migrate = this.db.transaction(() => {
        for (const book of (raw.books ?? [])) {
          safeValidate(book, BookSchema, 'migrateFromJson.book');
          insertBook.run(book.id, JSON.stringify(book));
        }
        for (const [key, value] of Object.entries(raw.settings ?? {})) {
          insertSetting.run(key, String(value));
        }
        for (const [id, details] of Object.entries(raw.bookDetails ?? {})) {
          safeValidate(details, BookDetailsSchema, 'migrateFromJson.details');
          insertDetail.run(id, JSON.stringify(details));
        }
      });

      migrate();
      fs.renameSync(jsonPath, jsonPath + '.migrated');
      console.log('Migrated db.json to SQLite successfully.');
    } catch (e) {
      console.error('Migration from db.json failed:', e);
    }
  }

  saveBooks(books: Book[], options?: { pruneMissing?: boolean }) {
    const existing = this.db.prepare('SELECT id, data FROM books').all() as { id: string; data: string }[];
    const existingMap = new Map<string, Book>(existing.map(r => [r.id, safeParseJSON<Book>(r.data, BookSchema, 'saveBooks.existing')]));
    const mergedBooks = mergeBooksForSave(existingMap, books, options);
    const finalIds = new Set(mergedBooks.map(book => book.id));

    const upsert = this.db.prepare('INSERT OR REPLACE INTO books (id, data) VALUES (?, ?)');
    const deleteBook = this.db.prepare('DELETE FROM books WHERE id = ?');
    const deleteDetails = this.db.prepare('DELETE FROM book_details WHERE id = ?');
    const upsertAll = this.db.transaction((finalBooks: Book[]) => {
      for (const book of finalBooks) {
        upsert.run(book.id, JSON.stringify(book));
      }

      for (const existingId of existingMap.keys()) {
        if (finalIds.has(existingId)) continue;
        deleteBook.run(existingId);
        deleteDetails.run(existingId);
      }
    });

    upsertAll(mergedBooks);
  }

  getBooks(): Book[] {
    const rows = this.db.prepare('SELECT data FROM books').all() as { data: string }[];
    return rows.map(r => safeParseJSON<Book>(r.data, BookSchema, 'getBooks')).sort((a, b) => a.title.localeCompare(b.title));
  }

  updateBookStatus(id: string, isDownloaded: boolean, path?: string) {
    const row = this.db.prepare('SELECT data FROM books WHERE id = ?').get(id) as { data: string } | undefined;
    if (!row) return;
    const book = safeParseJSON(row.data, BookSchema, 'updateBookStatus');
    (book as any).isDownloaded = isDownloaded;
    (book as any).lastDownloadAt = isDownloaded ? new Date().toISOString() : null;
    if (path) {
      (book as any).nasPath = path;
    } else if (!isDownloaded) {
      (book as any).nasPath = null;
    }
    
    // Clear transient progress fields when finished
    if (isDownloaded) {
      delete (book as any).downloadProgress;
      delete (book as any).downloadPhase;
    }
    
    this.db.prepare('UPDATE books SET data = ? WHERE id = ?').run(JSON.stringify(book), id);
  }

  updateDownloadProgress(id: string, progress: number, phase: string) {
    const row = this.db.prepare('SELECT data FROM books WHERE id = ?').get(id) as { data: string } | undefined;
    if (!row) return;
    const book = safeParseJSON(row.data, BookSchema, 'updateDownloadProgress');
    (book as any).downloadProgress = progress;
    (book as any).downloadPhase = phase;
    this.db.prepare('UPDATE books SET data = ? WHERE id = ?').run(JSON.stringify(book), id);
  }

  toggleIgnored(id: string): boolean {
    const row = this.db.prepare('SELECT data FROM books WHERE id = ?').get(id) as { data: string } | undefined;
    if (!row) return false;
    const book = safeParseJSON(row.data, BookSchema, 'toggleIgnored');
    (book as any).isIgnored = !book.isIgnored;
    this.db.prepare('UPDATE books SET data = ? WHERE id = ?').run(JSON.stringify(book), id);
    return (book as any).isIgnored;
  }

  updateBooksStatus(foundMap: Map<string, string>, resetUnmatched = true) {
    const rows = this.db.prepare('SELECT id, data FROM books').all() as { id: string; data: string }[];
    const update = this.db.prepare('UPDATE books SET data = ? WHERE id = ?');

    const applyAll = this.db.transaction(() => {
      for (const row of rows) {
        const book = safeParseJSON(row.data, BookSchema, 'updateBooksStatus') as any;
        const foundPath = foundMap.get(row.id);
        const found = !!foundPath;

        // If resetUnmatched is false, we only ever set isDownloaded to true, never false.
        // This prevents race conditions where a slow scan might "revert" a successful download.
        if (found) {
          let changed = false;
          if (!book.isDownloaded) {
            book.isDownloaded = true;
            if (!book.lastDownloadAt) book.lastDownloadAt = new Date().toISOString();
            changed = true;
          }
          if (book.nasPath !== foundPath) {
            book.nasPath = foundPath;
            changed = true;
          }
          if (changed) {
            update.run(JSON.stringify(book), row.id);
          }
        } else if (!found && book.isDownloaded && resetUnmatched) {
          book.isDownloaded = false;
          book.lastDownloadAt = null;
          book.nasPath = null;
          update.run(JSON.stringify(book), row.id);
        }
      }
    });

    applyAll();
  }

  updateAzureSilentStatus(silentIds: Set<string>) {
    const rows = this.db.prepare('SELECT id, data FROM books').all() as { id: string; data: string }[];
    const update = this.db.prepare('UPDATE books SET data = ? WHERE id = ?');

    const applyAll = this.db.transaction(() => {
      for (const row of rows) {
        const book = safeParseJSON(row.data, BookSchema, 'updateAzureSilentStatus') as any;
        const isSilent = silentIds.has(row.id);
        if (Boolean(book.azureHasSilent) !== isSilent) {
          book.azureHasSilent = isSilent;
          update.run(JSON.stringify(book), row.id);
        }
      }
    });

    applyAll();
  }

  updateAbsStatus(ids: Set<string>, resetUnmatched = false) {
    const rows = this.db.prepare('SELECT id, data FROM books').all() as { id: string; data: string }[];
    const update = this.db.prepare('UPDATE books SET data = ? WHERE id = ?');
    const confirmedAt = new Date().toISOString();

    const applyAll = this.db.transaction(() => {
      for (const row of rows) {
        const book = safeParseJSON(row.data, BookSchema, 'updateAbsStatus') as any;
        const found = ids.has(row.id);

        if (found && !book.isInAbs) {
          book.isInAbs = true;
          book.lastAbsConfirmedAt = confirmedAt;
          update.run(JSON.stringify(book), row.id);
        } else if (found && book.lastAbsConfirmedAt == null) {
          book.lastAbsConfirmedAt = confirmedAt;
          update.run(JSON.stringify(book), row.id);
        } else if (!found && book.isInAbs && resetUnmatched) {
          book.isInAbs = false;
          book.lastAbsConfirmedAt = null;
          update.run(JSON.stringify(book), row.id);
        }
      }
    });

    applyAll();
  }

  saveBookDetails(id: string, details: BookDetails) {
    this.db.prepare('INSERT OR REPLACE INTO book_details (id, data) VALUES (?, ?)').run(id, JSON.stringify(details));
  }

  getBookDetails(id: string): BookDetails | null {
    const row = this.db.prepare('SELECT data FROM book_details WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? safeParseJSON<BookDetails>(row.data, BookDetailsSchema, 'getBookDetails') : null;
  }

  getAllBookDetails(): Record<string, BookDetails> {
    const rows = this.db.prepare('SELECT id, data FROM book_details').all() as { id: string; data: string }[];
    return Object.fromEntries(rows.map(r => [r.id, safeParseJSON<BookDetails>(r.data, BookDetailsSchema, 'getAllBookDetails')]));
  }

  getSetting(key: string, defaultValue: string): string {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? defaultValue;
  }

  setSetting(key: string, value: string) {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  getAllSettings(): Array<{ key: string; value: string }> {
    return this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  }

  // --- Logs ---
  addLog(type: 'success' | 'error' | 'info', title: string, message: string) {
    this.db.prepare('INSERT INTO logs (type, title, message, timestamp) VALUES (?, ?, ?, ?)').run(
      type,
      title,
      message,
      new Date().toISOString(),
    );
  }

  getLogs(limit: number = 1000): LogEntry[] {
    return this.db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(limit) as LogEntry[];
  }

  clearLogs() {
    this.db.prepare('DELETE FROM logs').run();
  }
}
