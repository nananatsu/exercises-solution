export interface ImageCacheItem {
    hash: string;
    originalUri: string;
    uploadedUrl: string;
    timestamp: number;
}

export interface ImageCache {
    [hash: string]: ImageCacheItem;
} 