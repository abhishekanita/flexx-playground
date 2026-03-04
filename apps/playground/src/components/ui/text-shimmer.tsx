'use client';
import React, { useMemo, type JSX } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/utils/utils';

interface TextShimmerProps {
    children: string;
    as?: React.ElementType;
    className?: string;
    duration?: number;
    spread?: number;
}

export function TextShimmer({ children, as: Component = 'p', className, duration = 2, spread = 2 }: TextShimmerProps) {
    const dynamicSpread = useMemo(() => {
        return children.length * spread;
    }, [children, spread]);

    return (
        <AnimatePresence>
            <motion.span
                className={cn('relative inline-block', 'bg-clip-text text-transparent', 'bg-[size:200%_100%]', className)}
                initial={{ backgroundPosition: '200% center' }}
                animate={{ backgroundPosition: '-200% center' }}
                transition={{
                    repeat: Infinity,
                    duration,
                    ease: 'linear',
                    // repeatDelay: 20,
                }}
                style={
                    {
                        '--spread': `${dynamicSpread}px`,
                        backgroundImage: `linear-gradient(
                        90deg,
                        var(--base-color) 0%,
                        var(--base-color) calc(50% - var(--spread)),
                        var(--base-gradient-color) 50%,
                        var(--base-color) calc(50% + var(--spread)),
                        var(--base-color) 100%
                    )`,
                        '--base-color': '#a1a1aa',
                        '--base-gradient-color': '#000',
                    } as React.CSSProperties
                }
            >
                {children}
            </motion.span>
        </AnimatePresence>
    );
}

interface CardShimmerProps {
    children: React.ReactNode;
    className?: string;
    /** seconds for one pass */
    duration?: number;
    /** seconds to wait before starting */
    delay?: number;
    /** 0–1, strength of the bright band */
    intensity?: number;
    /** pause animation (e.g., when offscreen) */
    paused?: boolean;
    /** background behind children while loading */
    baseBgClassName?: string;
}

export function CardShimmer({
    children,
    className,
    duration = 1.6,
    delay = 0,
    intensity = 0.15,
    paused = false,
    baseBgClassName,
}: CardShimmerProps) {
    const prefersReducedMotion = useReducedMotion();

    // Middle stop alpha for the bright band
    const alpha = Math.max(0, Math.min(1, intensity));
    const midRGBA = `rgba(255,255,255,${alpha})`;

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-inherit', // rounded-inherit if you use a plugin; else keep overflow-hidden
                baseBgClassName // optional skeleton base
            )}
            // Let border radius clip the shine without masking hacks
            style={{ borderRadius: 'inherit' }}
        >
            {/* Optional base skeleton tint */}
            {/* e.g., pass "bg-zinc-900/5 dark:bg-zinc-50/[0.06]" via baseBgClassName */}
            <div className={cn('relative', className)}>{children}</div>

            {/* Shimmer: a narrow gradient bar moving left -> right */}
            {!prefersReducedMotion && !paused && (
                <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2"
                    style={{
                        // Transparent -> bright -> transparent
                        background: `linear-gradient(90deg, transparent 0%, ${midRGBA} 50%, transparent 100%)`,
                        willChange: 'transform',
                    }}
                    initial={{ x: '-200%' }}
                    animate={{ x: '200%' }}
                    transition={{
                        repeat: Infinity,
                        ease: 'linear',
                        duration,
                        delay,
                    }}
                />
            )}
        </div>
    );
}
