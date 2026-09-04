import { openDB } from 'idb';

const DB_NAME = 'nyalur-db';
const DB_VERSION = 1;
const STORE_NAME = 'transfers';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('direction', 'direction');
      }
    }
  });
}

export async function addTransfer(record) {
  try {
    const db = await getDB();
    const id = 'trf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    await db.put(STORE_NAME, {
      ...record,
      id: id,
      timestamp: new Date().toISOString()
    });
    return id;
  } catch (e) {
    console.error('Failed to save transfer record:', e);
    return null;
  }
}

export async function getTransfers(limit = 50) {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex(STORE_NAME, 'timestamp');
    return all.reverse().slice(0, limit);
  } catch (e) {
    console.error('Failed to load transfers:', e);
    return [];
  }
}

export async function clearTransfers() {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch (e) {
    console.error('Failed to clear transfers:', e);
  }
}
