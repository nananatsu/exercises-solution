import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export async function compressImage(uri: string): Promise<string> {
    try {
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1024 } }], // 限制最大宽度为1024
            {
                compress: 0.8, // 80%质量
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );
        return result.uri;
    } catch (error) {
        console.error('Image compression failed:', error);
        return uri; // 如果压缩失败，返回原始URI
    }
}

export async function imageToBase64(uri: string): Promise<string> {
    if (Platform.OS === 'web') {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';  // 处理跨域问题
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // 设置canvas尺寸为图片尺寸
                canvas.width = img.width;
                canvas.height = img.height;

                // 将图片绘制到canvas
                ctx.drawImage(img, 0, 0);

                try {
                    // 转换为base64，去掉data:image/jpeg;base64,前缀
                    const base64 = canvas.toDataURL('image/jpeg', 0.8)
                        .replace(/^data:image\/\w+;base64,/, '');
                    resolve(base64);
                } catch (error) {
                    console.error('Canvas to base64 failed:', error);
                    reject(new Error('Failed to convert canvas to base64'));
                }
            };

            img.onerror = () => {
                console.error('Image loading failed');
                reject(new Error('Failed to load image'));
            };

            // 如果是 blob URL 或 data URL，直接使用
            if (uri.startsWith('blob:') || uri.startsWith('data:')) {
                img.src = uri;
            } else {
                // 如果是相对路径，需要转换为完整 URL
                img.src = uri.startsWith('http') ? uri : window.location.origin + uri;
            }
        });
    }

    try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        return base64;
    } catch (error) {
        console.error('Failed to convert image to base64:', error);
        throw new Error('Failed to convert image to base64');
    }
}

// 辅助函数：检查是否是有效的 base64 字符串
export function isValidBase64(str: string): boolean {
    try {
        return btoa(atob(str)) === str;
    } catch (err) {
        return false;
    }
} 