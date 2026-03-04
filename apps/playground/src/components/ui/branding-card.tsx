// components/ui/branding-card.tsx
import * as React from 'react';
import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/utils/utils';
import type { ThemeColorKey } from './color-picker';

// JSDoc for props documentation
export interface BrandingCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
    /** The main category label displayed at the top. */
    category: string;
    /** The primary title for the branding element. */
    title: string;
    /** Callback when a color swatch is clicked */
    onColorClick?: (colorKey: ThemeColorKey, currentColor: string) => void;
    /** The subtitle or specific name (e.g., font name). */
    subtitle: string;
    /** The visual element to display, typically text or an icon. */
    displayElement: React.ReactNode;
    /** Theme colors object */
    theme: {
        primary?: string;
        accent?: string;
        background?: string;
        text?: string;
        secondary?: string;
    };
}

// Helper to convert hex to RGB
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
};

// Helper to determine if a color is light
const isLightColor = (hex: string): boolean => {
    const rgb = hexToRgb(hex);
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5;
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: 'easeOut',
            when: 'beforeChildren',
            staggerChildren: 0.1,
        },
    },
};

const swatchVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.3,
            ease: 'easeOut',
        },
    },
};

interface ColorSwatchProps {
    color: string;
    colorKey: ThemeColorKey;
    label: string;
    onClick?: (colorKey: ThemeColorKey, color: string) => void;
    isFirst?: boolean;
    isLast?: boolean;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ color, colorKey, label, onClick, isFirst, isLast }) => {
    const [isHovered, setIsHovered] = useState(false);
    const rgb = hexToRgb(color);
    const textColor = isLightColor(color) ? 'text-gray-800' : 'text-white';

    return (
        <motion.div
            className={cn(
                'h-full flex-1 cursor-pointer relative flex flex-col items-start justify-end p-3 transition-all',
                isFirst && 'rounded-bl-lg',
                isLast && 'rounded-br-lg'
            )}
            style={{ backgroundColor: color }}
            variants={swatchVariants}
            aria-label={`${label}: ${color}`}
            onClick={() => onClick?.(colorKey, color)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ scale: 1.02, zIndex: 10 }}
        >
            <motion.div
                className={cn('font-mono text-[10px] leading-tight', textColor)}
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.15 }}
            >
                <div>R {rgb.r}</div>
                <div>G {rgb.g}</div>
                <div>B {rgb.b}</div>
            </motion.div>
            <motion.span
                className={cn('text-[10px] font-medium mt-1 uppercase tracking-wide', textColor)}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: isHovered ? 1 : 0.7 }}
            >
                {label}
            </motion.span>
        </motion.div>
    );
};

const BrandingCard = React.forwardRef<HTMLDivElement, BrandingCardProps>(
    ({ className, category, title, subtitle, displayElement, onColorClick, theme }, ref) => {
        const colorSwatches: { key: ThemeColorKey; label: string; color: string }[] = [
            { key: 'primary', label: 'Primary', color: theme?.primary ?? '#3b82f6' },
            { key: 'accent', label: 'Accent', color: theme?.accent ?? '#8b5cf6' },
            { key: 'background', label: 'Background', color: theme?.background ?? '#ffffff' },
            { key: 'text', label: 'Text', color: theme?.text ?? '#0f172a' },
        ];

        return (
            <motion.div
                ref={ref}
                className={cn(
                    'w-full max-w-sm overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow duration-300 hover:shadow-lg',
                    className
                )}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                aria-label={`${category}: ${title}`}
                role="group"
            >
                {/* Main content area */}
                <div className="p-6">
                    <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">{category}</p>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
                            <p className="text-lg text-muted-foreground">{subtitle}</p>
                        </div>
                        <div className="text-5xl font-bold tracking-tighter">{displayElement}</div>
                    </div>
                </div>

                {/* Color palette section */}
                <div className="flex h-24 w-full">
                    {colorSwatches.map((swatch, index) => (
                        <ColorSwatch
                            key={swatch.key}
                            color={swatch.color}
                            colorKey={swatch.key}
                            label={swatch.label}
                            onClick={onColorClick}
                            isFirst={index === 0}
                            isLast={index === colorSwatches.length - 1}
                        />
                    ))}
                </div>
            </motion.div>
        );
    }
);

BrandingCard.displayName = 'BrandingCard';

export { BrandingCard };
