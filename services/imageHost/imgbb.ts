import FormData from 'form-data';

import { ImageHost, ImageHostConfig, UploadResult } from './types';

export class ImgbbHost implements ImageHost {
    async upload(base64Image: string, config: ImageHostConfig): Promise<UploadResult> {
        try {
            const formData = new FormData();
            formData.append('image', base64Image);
            
            const response = await fetch('https://api.imgbb.com/1/upload?key=' + config.apiKey, {
                method: 'POST',
                // headers: {
                //     'Content-Type': 'multipart/form-data',
                // },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            return {
                success: true,
                url: data.data.url,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Upload failed',
            };
        }
    }
} 