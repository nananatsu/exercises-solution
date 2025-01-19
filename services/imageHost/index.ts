import { ImageHost, ImageHostConfig } from './types';
import { ImgbbHost } from './imgbb';

const hosts: Record<string, ImageHost> = {
    imgbb: new ImgbbHost(),
};

export async function uploadImage(base64Image: string, config: ImageHostConfig) {
    const host = hosts[config.type];
    if (!host) {
        throw new Error(`Unsupported image host: ${config.type}`);
    }
    return host.upload(base64Image, config);
}

export type { ImageHostConfig, UploadResult } from './types'; 