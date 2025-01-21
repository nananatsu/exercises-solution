import { MMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Web平台使用 AsyncStorage，其他平台使用 MMKV
const isWeb = Platform.OS === 'web';

export class Storage {
    private static instance: Storage;
    private storage: MMKV | null = null;

    private constructor() {
        if (isWeb) {
            this.storage = new MMKV({
                id: 'app-storage',
            });
        } else {
            this.storage = new MMKV({
                id: 'app-storage',
                encryptionKey: 'exercises-solution'
            });
        }

    }

    static getInstance(): Storage {
        if (!Storage.instance) {
            Storage.instance = new Storage();
        }
        return Storage.instance;
    }

    async getItem<T>(key: string): Promise<T | null> {
        try {
            const value = this.storage?.getString(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Failed to get item: ${key}`, error);
            return null;
        }
    }

    async setItem(key: string, value: any): Promise<void> {
        try {
            const stringValue = JSON.stringify(value);
            this.storage?.set(key, stringValue);
        } catch (error) {
            console.error(`Failed to set item: ${key}`, error);
        }
    }

    async removeItem(key: string): Promise<void> {
        try {
            this.storage?.delete(key);
        } catch (error) {
            console.error(`Failed to remove item: ${key}`, error);
        }
    }

    async getAllKeys(): Promise<readonly string[]> {
        try {
            return this.storage?.getAllKeys() || [];
        } catch (error) {
            console.error('Failed to get all keys', error);
            return [];
        }
    }
}

export const storage = Storage.getInstance(); 