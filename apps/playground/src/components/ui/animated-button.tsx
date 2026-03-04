import { cn } from '@/utils/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon, type LucideIcon } from 'lucide-react';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';
import { PopoverContent } from '@radix-ui/react-popover';
import { EmojiPickerEmojiPicker } from '@/components/ui/emoji-picker';

const colors = {
    pink: {
        bg: 'bg-red-50',
        border: 'border-red-400',
        text: 'text-red-400',
    },
    blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-400',
        text: 'text-blue-400',
    },
    green: {
        bg: 'bg-green-50',
        border: 'border-green-400',
        text: 'text-green-400',
    },
    yellow: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-400',
        text: 'text-yellow-400',
    },
    purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-400',
        text: 'text-purple-400',
    },
};
const AnimatedToggleButton = ({
    handleToggle,
    isActive,
    label,
    color,
    showCancel,
}: {
    handleToggle: () => void;
    isActive: boolean;
    showCancel: boolean;
    label: {
        icon: LucideIcon;
        text: string;
    };
    color?: string;
}) => {
    const color_ = colors[color as keyof typeof colors];
    return (
        <button
            type="button"
            onClick={e => {
                e.stopPropagation();
                handleToggle();
            }}
            className={cn(
                'rounded-full transition-all flex items-center ',
                label.text ? 'gap-1 px-2 py-1 border h-8' : 'gap-2 border h-8 w-8 justify-center',
                isActive
                    ? `${color_?.bg} ${color_?.border} ${color_?.text}`
                    : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'
            )}
        >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <motion.div
                    animate={{
                        rotate: isActive ? 360 : 0,
                        scale: isActive ? 1.1 : 1,
                    }}
                    whileHover={{
                        rotate: isActive ? 360 : 15,
                        scale: 1.1,
                        transition: {
                            type: 'spring',
                            stiffness: 300,
                            damping: 10,
                        },
                    }}
                    transition={{
                        type: 'spring',
                        stiffness: 260,
                        damping: 25,
                    }}
                >
                    <label.icon className={cn('w-4 h-4', isActive ? color_?.text : 'text-inherit')} />
                </motion.div>
            </div>
            {label.text && (
                <AnimatePresence>
                    {isActive && (
                        <motion.span
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                'text-xs flex items-center cursor-pointer overflow-hidden whitespace-nowrap flex-shrink-0',
                                color_?.text
                            )}
                        >
                            {label.text}
                            {showCancel ? <XIcon className="size-4 ms-1" /> : ''}
                        </motion.span>
                    )}
                </AnimatePresence>
            )}
        </button>
    );
};

export default AnimatedToggleButton;
