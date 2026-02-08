
"use client";

import { IndexedDBStorageProvider } from './storage/indexeddb';
import { SupabaseStorageProvider } from './storage/supabase';
import type { StorageProvider } from './storage/types';

export type StorageMode = 'local' | 'cloud';

let localProvider: StorageProvider | null = null;
let cloudProvider: StorageProvider | null = null;

export function getDataService(mode: StorageMode): StorageProvider {
    if (mode === 'local') {
        if (!localProvider) {
            localProvider = new IndexedDBStorageProvider();
        }
        return localProvider;
    } else {
        if (!cloudProvider) {
            cloudProvider = new SupabaseStorageProvider();
        }
        return cloudProvider;
    }
}
