export interface ImageHostConfig {
    type: string;
    apiKey: string;
    apiBase?: string;
}

export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

export interface ImageHost {
    upload(file: string, config: ImageHostConfig): Promise<UploadResult>;
} 