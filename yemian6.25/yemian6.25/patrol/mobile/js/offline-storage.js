class OfflineStorage {
  constructor() {
    this.db = null;
    this.dbName = 'patrol_offline_db';
    this.storeName = 'pending_points';
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
          store.createIndex('recorded_at', 'recorded_at');
          store.createIndex('synced', 'synced');
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async addPoint(point) {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).add({ ...point, synced: 0, stored_at: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }

  async getUnsyncedCount() {
    if (!this.db) return 0;
    return new Promise((resolve) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const idx = store.index('synced');
      const req = idx.count(IDBKeyRange.only(0));
      req.onsuccess = () => resolve(req.result);
    });
  }

  async getBatchForSync(batchSize = 200) {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const idx = store.index('recorded_at');
      const batch = [];
      const cursorReq = idx.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && batch.length < batchSize) {
          if (cursor.value.synced === 0) {
            batch.push({ ...cursor.value });
            cursor.update({ ...cursor.value, synced: 1 }); // 乐观标记
          }
          cursor.continue();
        } else {
          resolve(batch);
        }
      };
      cursorReq.onerror = reject;
    });
  }

  async markFailed(batch) {
    if (!this.db) return;
    const tx = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    for (const p of batch) {
      store.put({ ...p, synced: 0 });
    }
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  }

  async purgeUploaded(batch) {
    if (!this.db) return;
    const tx = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    for (const p of batch) {
      store.delete(p.id);
    }
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  }
}
