"use client";

const DB_NAME = 'CryptoWatcherDB';
const DB_VERSION = 1;
const STORE_NAME = 'CryptoWatcherStore';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
        return reject('IndexedDB not supported');
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Error opening DB", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
  return dbPromise;
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(value, key);
    
    transaction.oncomplete = () => {
      resolve();
    };
    
    transaction.onerror = () => {
      console.error('Error setting item:', transaction.error);
      reject(transaction.error);
    };
  });
}

export async function getItem<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result as T | undefined);
    };

    request.onerror = () => {
      console.error('Error getting item:', request.error);
      reject(request.error);
    };
  });
}

export async function removeItem(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);
    
    transaction.oncomplete = () => {
      resolve();
    };
    
    transaction.onerror = () => {
      console.error('Error removing item:', transaction.error);
      reject(transaction.error);
    };
  });
}

    