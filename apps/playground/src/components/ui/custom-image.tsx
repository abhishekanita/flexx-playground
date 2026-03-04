import React, { useState, useCallback, type ImgHTMLAttributes } from 'react';
import { cn } from '@/utils/utils';

interface CustomImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
    fallback?: React.ReactNode | string;
    skeleton?: React.ReactNode;
    onLoad?: () => void;
    onError?: () => void;
    containerClassName?: string;
    skeletonClassName?: string;
    errorClassName?: string;
}

const CustomImage: React.FC<CustomImageProps> = ({
    src,
    alt = '',
    className,
    containerClassName,
    skeletonClassName,
    errorClassName,
    fallback,
    skeleton,
    onLoad,
    onError,
    ...props
}) => {
    if (!src) {
        return fallback;
    }
    const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');

    const handleLoad = useCallback(() => {
        setImageState('loaded');
        onLoad?.();
    }, [onLoad]);

    const handleError = useCallback(() => {
        setImageState('error');
        onError?.();
    }, [onError]);

    const defaultSkeleton = (
        <div
            className={cn('animate-pulse bg-gray-200 dark:bg-gray-700 rounded', skeletonClassName)}
            style={{ width: props.width || '100%', height: props.height || '100%' }}
        />
    );

    const defaultFallback = (
        <div
            className={cn(
                'flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded',
                errorClassName
            )}
            style={{ width: props.width || '100%', height: props.height || '100%' }}
        >
            <svg
                className="w-8 h-8"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                />
            </svg>
        </div>
    );

    return (
        <div className={cn('relative ', containerClassName)}>
            {imageState === 'loading' && (skeleton || defaultSkeleton)}
            {!src
                ? fallback
                : imageState === 'error' &&
                  (typeof fallback === 'string' ? (
                      <img
                          src={fallback}
                          alt={alt}
                          className={cn(className, errorClassName)}
                          {...props}
                      />
                  ) : (
                      fallback || defaultFallback
                  ))}

            {src && (
                <img
                    src={src}
                    alt={alt}
                    className={cn(
                        className,
                        imageState === 'loading' && 'opacity-0 absolute inset-0',
                        imageState === 'error' && 'hidden'
                    )}
                    onLoad={handleLoad}
                    onError={handleError}
                    {...props}
                />
            )}
        </div>
    );
};

export default CustomImage;
