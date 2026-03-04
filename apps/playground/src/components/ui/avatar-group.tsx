'use client';

import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarFallback, LoreleiAvatar, UserAvatar } from './avatar';
import CustomImage from './custom-image';
import { cn } from '@/utils/utils';

export interface AvatarGroupProps {
    avatars: { src: string; alt?: string; label?: string; seed?: string; onClick?: any }[];
    maxVisible?: number;
    size?: number;
    overlap?: number;
    roundedClass?: string;
}

const AvatarGroup = ({ avatars, roundedClass, maxVisible = 5, size = 40, overlap = 14 }: AvatarGroupProps) => {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const visibleAvatars = avatars.slice(0, maxVisible);
    const extraCount = avatars.length - maxVisible;

    const roundedClass_ = roundedClass || 'rounded-full';
    return (
        <div className="flex items-center relative">
            <div className="flex -space-x-3">
                {visibleAvatars.map((avatar, idx) => {
                    const isHovered = hoveredIdx === idx;
                    return (
                        <div
                            key={idx}
                            className={`border-primary-50 bg-background border ${roundedClass_}  transition-all duration-300 `}
                            style={{
                                width: size,
                                height: size,
                                zIndex: isHovered ? 100 : visibleAvatars.length - idx,
                                marginLeft: -overlap,
                                position: 'relative',
                                transition:
                                    'margin-left 0.3s cubic-bezier(0.4,0,0.2,1), z-index 0s, box-shadow 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                                transform: isHovered ? 'translateY(2px)' : 'translateY(0)',
                            }}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onClick={() => avatar?.onClick()}
                            onMouseLeave={() => setHoveredIdx(null)}
                        >
                            <CustomImage
                                src={avatar.src}
                                alt={avatar.label}
                                fallback={<LoreleiAvatar seed={avatar.seed} />}
                                containerClassName={roundedClass_}
                                className={roundedClass_}
                            />
                            <AnimatePresence>
                                {isHovered && avatar.label && (
                                    <motion.div
                                        key="tooltip"
                                        initial={{
                                            x: '-50%',
                                            y: -20,
                                            opacity: 0,
                                            scale: 0.9,
                                        }}
                                        animate={{
                                            x: '-50%',
                                            y: 0,
                                            opacity: 1,
                                            scale: 1,
                                        }}
                                        exit={{
                                            x: '-50%',
                                            y: -20,
                                            opacity: 0,
                                            scale: 0.9,
                                        }}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 400,
                                            damping: 24,
                                        }}
                                        className="absolute z-50 px-2 py-2 bg-primary-foreground text- text-xs rounded shadow-lg whitespace-nowrap pointer-events-none "
                                        style={{
                                            top: size,
                                            left: '50%',
                                        }}
                                    >
                                        {avatar.label}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
                {extraCount > 0 && (
                    <div
                        className="flex items-center justify-center bg-primary text-primary-foreground font-semibold border-2 rounded-full"
                        style={{
                            width: size,
                            height: size,
                            marginLeft: -overlap,
                            zIndex: 0,
                            fontSize: size * 0.32,
                            transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
                        }}
                    >
                        +{extraCount}
                    </div>
                )}
            </div>
        </div>
    );
};

export { AvatarGroup };
