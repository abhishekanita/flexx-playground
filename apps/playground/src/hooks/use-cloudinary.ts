import { CLOUDINARY_CLOUD_NAME } from '@/config';
import { axios } from '@/utils/axios';
import { useState, useCallback, useRef } from 'react';

// Types
interface CloudinarySignatureResponse {
    signature: string;
    timestamp: number;
    api_key: string;
    cloud_name: string;
    folder?: string;
    public_id?: string;
    upload_url: string;
}

interface UploadOptions {
    folder?: string;
    public_id?: string;
    resource_type?: 'image' | 'video' | 'raw' | 'auto';
    tags?: string[];
    transformation?: any[];
    maxFileSize?: number; // in bytes
    allowedTypes?: string[];
    onProgress?: (progress: number) => void;
    onComplete?: (result: CloudinaryUploadResult) => void;
    onError?: (error: UploadError) => void;
}

export interface CloudinaryUploadResult {
    name: string;
    public_id: string;
    secure_url: string;
    url: string;
    resource_type: string;
    format: string;
    bytes: number;
    width?: number;
    height?: number;
    original_filename: string;
    created_at: string;
    metadata?: Record<string, any>;
}

interface UploadError {
    message: string;
    code?: string;
    http_code?: number;
}

interface UploadState {
    isUploading: boolean;
    progress: number;
    error: UploadError | null;
    result: CloudinaryUploadResult | null;
    abortController: AbortController | null;
}

interface TransformOptions {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'crop' | 'pad' | 'lpad' | 'mpad' | 'thumb' | 'imagga_crop' | 'imagga_scale';
    quality?: 'auto' | number;
    format?: 'auto' | 'jpg' | 'png' | 'webp' | 'avif';
    gravity?: 'auto' | 'face' | 'center' | 'north' | 'south' | 'east' | 'west';
    effects?: string[];
    [key: string]: any;
}

export const useCloudinary = (config?: any) => {
    const [uploadState, setUploadState] = useState<UploadState>({
        isUploading: false,
        progress: 0,
        error: null,
        result: null,
        abortController: null,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    // Get upload signature from backend
    const getUploadSignature = useCallback(async (options?: UploadOptions): Promise<CloudinarySignatureResponse> => {
        const response = await axios.post('/upload/signature', {
            folder: options?.folder,
            public_id: options?.public_id,
            resource_type: options?.resource_type || 'auto',
            tags: options?.tags,
            transformation: options?.transformation,
        });
        return response.data.data;
    }, []);

    // Upload file to Cloudinary
    const uploadToCloudinary = useCallback(
        async (file: File, signature: CloudinarySignatureResponse, options?: UploadOptions): Promise<CloudinaryUploadResult> => {
            const formData = new FormData();

            // Add file
            formData.append('file', file);

            // Add signature data
            formData.append('signature', signature.signature);
            formData.append('timestamp', signature.timestamp.toString());
            formData.append('api_key', signature.api_key);

            // Add optional parameters
            if (signature.public_id) formData.append('public_id', signature.public_id);
            if (signature.folder) formData.append('folder', signature.folder);
            if (options?.tags) formData.append('tags', options.tags.join(','));
            formData.append('resource_type', 'auto');

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                // Track upload progress
                xhr.upload.addEventListener('progress', event => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        setUploadState(prev => ({ ...prev, progress }));
                        options?.onProgress?.(progress);
                    }
                });

                xhr.addEventListener('load', async () => {
                    if (xhr.status === 200) {
                        try {
                            const result = JSON.parse(xhr.responseText) as CloudinaryUploadResult;
                            console.log('result', result);
                            const verificationResponse = await axios.post('/upload/complete', result);
                            resolve(verificationResponse.data.data);
                        } catch (error) {
                            reject(new Error('Failed to parse upload response'));
                        }
                    } else {
                        try {
                            const error = JSON.parse(xhr.responseText);
                            reject(new Error(error.error?.message || 'Upload failed'));
                        } catch {
                            reject(new Error(`Upload failed with status ${xhr.status}`));
                        }
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Network error occurred during upload'));
                });

                xhr.addEventListener('abort', () => {
                    reject(new Error('Upload was cancelled'));
                });

                xhr.open('POST', signature.upload_url);
                xhr.send(formData);

                // Store xhr for potential cancellation
                abortControllerRef.current = {
                    abort: () => xhr.abort(),
                    signal: { aborted: false } as AbortSignal,
                } as AbortController;
            });
        },
        []
    );

    // Main upload function
    const uploadFile = useCallback(
        async (file: File, options?: UploadOptions) => {
            try {
                setUploadState({
                    isUploading: true,
                    progress: 0,
                    error: null,
                    result: null,
                    abortController: abortControllerRef.current,
                });

                // Get upload signature
                const signature = await getUploadSignature(options);

                // Upload to Cloudinary
                const result = await uploadToCloudinary(file, signature, options);
                console.log('upload to cloudinary', result);

                setUploadState(prev => ({
                    ...prev,
                    isUploading: false,
                    result,
                    progress: 100,
                    abortController: null,
                }));

                options?.onComplete?.(result);
                return result;
            } catch (error) {
                const uploadError = {
                    message: error instanceof Error ? error.message : 'Upload failed',
                    code: 'UPLOAD_ERROR',
                };

                setUploadState(prev => ({
                    ...prev,
                    isUploading: false,
                    error: uploadError,
                    abortController: null,
                }));

                options?.onError?.(uploadError);
                throw uploadError;
            }
        },
        [getUploadSignature, uploadToCloudinary]
    );

    // Upload multiple files
    const uploadMultipleFiles = useCallback(
        async (
            files: File[],
            options?: UploadOptions & {
                onSingleComplete?: (result: CloudinaryUploadResult, index: number) => void;
                onSingleError?: (error: UploadError, index: number) => void;
            }
        ) => {
            const results: (CloudinaryUploadResult | UploadError)[] = [];

            for (let i = 0; i < files.length; i++) {
                try {
                    const result = await uploadFile(files[i], {
                        ...options,
                        onComplete: result => options?.onSingleComplete?.(result, i),
                        onError: error => options?.onSingleError?.(error, i),
                    });
                    if (result) results.push(result);
                } catch (error) {
                    results.push(error as UploadError);
                }
            }

            return results;
        },
        [uploadFile]
    );

    // Cancel upload
    const cancelUpload = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                abortController: null,
                error: { message: 'Upload cancelled by user' },
            }));
        }
    }, []);

    // Generate transformed URL
    const getTransformedUrl = useCallback((publicId: string, transforms: TransformOptions): string => {
        const cloudName = CLOUDINARY_CLOUD_NAME;
        if (!cloudName) {
            throw new Error('REACT_APP_CLOUDINARY_CLOUD_NAME environment variable is required');
        }

        const transformString = Object.entries(transforms)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => {
                if (key === 'effects' && Array.isArray(value)) {
                    return value.map(effect => `e_${effect}`).join(',');
                }
                return `${key.charAt(0)}_${value}`;
            })
            .join(',');

        const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
        return transformString ? `${baseUrl}/${transformString}/${publicId}` : `${baseUrl}/${publicId}`;
    }, []);

    // Reset upload state
    const resetUpload = useCallback(() => {
        setUploadState({
            isUploading: false,
            progress: 0,
            error: null,
            result: null,
            abortController: null,
        });
    }, []);

    return {
        // State
        isUploading: uploadState.isUploading,
        progress: uploadState.progress,
        error: uploadState.error,
        result: uploadState.result,

        // Actions
        uploadFile,
        uploadMultipleFiles,
        cancelUpload,
        resetUpload,

        // Utilities
        getTransformedUrl,
    };
};
