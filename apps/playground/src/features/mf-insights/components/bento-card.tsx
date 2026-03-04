import { cn } from '@/utils/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

interface BentoCardProps extends HTMLMotionProps<'div'> {
    variant?: 'default' | 'glass' | 'accent' | 'hero';
    index?: number;
}

const variantStyles: Record<string, string> = {
    default: 'bg-white dark:bg-[#0a0a0a] border-black/[0.04] dark:border-white/[0.06]',
    glass: 'bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl border-black/[0.04] dark:border-white/[0.06]',
    accent: 'bg-white dark:bg-[#0a0a0a] border-emerald-500/10 dark:border-emerald-400/10',
    hero: 'bg-white dark:bg-[#0a0a0a] border-black/[0.04] dark:border-white/[0.06]',
};

export const BentoCard = forwardRef<HTMLDivElement, BentoCardProps>(
    ({ variant = 'default', index = 0, className, children, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.5,
                    delay: index * 0.04,
                    ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{
                    y: -2,
                    transition: { duration: 0.2, ease: 'easeOut' },
                }}
                className={cn(
                    'rounded-xl border',
                    'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)]',
                    'dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.03)]',
                    'hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]',
                    'dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)]',
                    'transition-shadow duration-300',
                    variantStyles[variant],
                    className
                )}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

BentoCard.displayName = 'BentoCard';
