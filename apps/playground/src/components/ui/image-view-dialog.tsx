import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// ImageViewDialog Component
interface ImageViewDialogProps {
    images: string[];
    currentIndex: number;
    onClose: () => void;
    onIndexChange: (index: number) => void;
}

export const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ images, currentIndex, onClose, onIndexChange }) => {
    const isOpen = images.length > 0 && currentIndex >= 0;
    const currentImage = images[currentIndex];

    const goToPrevious = useCallback(() => {
        if (currentIndex > 0) {
            onIndexChange(currentIndex - 1);
        }
    }, [currentIndex, onIndexChange]);

    const goToNext = useCallback(() => {
        if (currentIndex < images.length - 1) {
            onIndexChange(currentIndex + 1);
        }
    }, [currentIndex, images.length, onIndexChange]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'Escape':
                    onClose();
                    break;
                case 'ArrowLeft':
                    goToPrevious();
                    break;
                case 'ArrowRight':
                    goToNext();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, goToPrevious, goToNext]);

    if (!isOpen || !currentImage) return null;

    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < images.length - 1;

    return (
        <Dialog open={isOpen} onOpenChange={() => onClose()}>
            <DialogContent className="p-0 border-none rounded-2xl backdrop-blur-2xl bg-white/40 backdrop-brightness-300 shadow-none max-w-[90vw] md:max-w-[800px]">
                <DialogTitle className="sr-only">Image Preview</DialogTitle>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="relative bg-[#1F2023] rounded-2xl overflow-hidden shadow-2xl"
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>

                        {/* Navigation buttons */}
                        {hasPrevious && (
                            <button
                                onClick={goToPrevious}
                                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                            >
                                <ChevronLeft className="w-6 h-6 text-white" />
                            </button>
                        )}
                        {hasNext && (
                            <button
                                onClick={goToNext}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                            >
                                <ChevronRight className="w-6 h-6 text-white" />
                            </button>
                        )}

                        <img
                            src={currentImage}
                            alt={`Image ${currentIndex + 1} of ${images.length}`}
                            className="w-full max-h-[80vh] object-contain rounded-2xl"
                        />

                        {/* Image counter */}
                        {images.length > 1 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
                                {currentIndex + 1} / {images.length}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};
