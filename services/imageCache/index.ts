import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { storage } from '@/services/storage';
import { STORAGE_KEYS } from '@/services/storage/constants';

export interface ImageCacheItem {
    hash: string;
    originalUri: string;
    uploadedUrl: string;
    timestamp: number;
}

export class ImageCacheManager {
    private static instance: ImageCacheManager;
    private cacheExpireDays: number = 7;

    private constructor() { }

    static getInstance(): ImageCacheManager {
        if (!ImageCacheManager.instance) {
            ImageCacheManager.instance = new ImageCacheManager();
        }
        return ImageCacheManager.instance;
    }

    private getCacheKey(hash: string): string {
        return `${STORAGE_KEYS.IMAGE_PREFIX}${hash}`;
    }

    private async calculateHash(uri: string): Promise<string> {
        let content = uri;
        if (Platform.OS !== 'web') {
            content = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
        }

        try {
            return await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                content
            );
        } catch (error) {
            console.error('Failed to calculate image hash:', error);
            throw error;
        }
    }

    private async isUrlValid(url: string): Promise<boolean> {
        try {
            const response = await fetch(url, { method: 'HEAD' });

            console.log('isUrlValid', response);

            return response.ok;
        } catch {
            return false;
        }
    }

    async getCachedUrl(uri: string): Promise<ImageCacheItem | null> {
        try {
            const hash = await this.calculateHash(uri);
            const cacheItem = await storage.getItem<ImageCacheItem>(this.getCacheKey(hash));
            if (cacheItem) {
                // 验证URL是否可用且未过期
                if (await this.isUrlValid(cacheItem.uploadedUrl) &&
                    Date.now() - cacheItem.timestamp < this.cacheExpireDays * 24 * 60 * 60 * 1000) {
                    return cacheItem;
                }
                // URL不可用或已过期，删除缓存
                await storage.removeItem(this.getCacheKey(hash));
            }
            return null;
        } catch (error) {
            console.error('Failed to get cached URL:', error);
            return null;
        }
    }

    async cacheUrl(uri: string, uploadedUrl: string): Promise<void> {
        try {
            const hash = await this.calculateHash(uri);
            const cacheItem: ImageCacheItem = {
                hash,
                originalUri: uri,
                uploadedUrl,
                timestamp: Date.now(),
            };
            await storage.setItem(this.getCacheKey(hash), cacheItem);
        } catch (error) {
            console.error('Failed to cache URL:', error);
            throw error;
        }
    }

    async clearExpiredCache(): Promise<void> {
        try {
            const expireTime = this.cacheExpireDays * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const keys = await storage.getAllKeys();
            for (const key of keys) {
                if (key.startsWith(STORAGE_KEYS.IMAGE_CACHE_PREFIX)) {
                    const cacheItem = await storage.getItem<ImageCacheItem>(key);
                    if (cacheItem && now - cacheItem.timestamp >= expireTime) {
                        await storage.removeItem(key);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to clear expired cache:', error);
        }
    }
}

export const imageCache = ImageCacheManager.getInstance(); 