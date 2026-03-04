import { cn } from '@/utils/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon, Check, type LucideIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useState } from 'react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';

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

export interface AnimatedSelectOption {
    label: string;
    value: string;
    icon?: LucideIcon;
}

interface AnimatedSelectButtonProps {
    options: AnimatedSelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    placeholderIcon?: LucideIcon;
    color?: keyof typeof colors;
    showCancel?: boolean;
    showSearch?: boolean;
    searchPlaceholder?: string;
}

const AnimatedSelectButton = ({
    options,
    value,
    onValueChange,
    placeholder = 'Select',
    placeholderIcon: PlaceholderIcon,
    color = 'blue',
    showCancel = false,
    showSearch = false,
    searchPlaceholder = 'Search option...',
}: AnimatedSelectButtonProps) => {
    const [open, setOpen] = useState(false);
    const color_ = colors[color];

    // Determine if button is in "active" state (has a value selected)
    const isActive = !!value;
    const selectedOption = options.find(opt => opt.value === value);

    // Use selected option's icon or placeholder icon
    const DisplayIcon = selectedOption?.icon || PlaceholderIcon;
    const displayText = selectedOption?.label || placeholder;

    const handleSelect = (selectedValue: string) => {
        // Toggle off if clicking the same value
        const newValue = selectedValue === value ? '' : selectedValue;
        onValueChange?.(newValue);
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onValueChange?.('');
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8',
                        isActive
                            ? `${color_?.bg} ${color_?.border} ${color_?.text}`
                            : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'
                    )}
                >
                    {DisplayIcon && (
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
                                <DisplayIcon className={cn('w-4 h-4', isActive ? color_?.text : 'text-inherit')} />
                            </motion.div>
                        </div>
                    )}

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
                                {displayText}
                                {showCancel && <XIcon className="size-4 ms-1" onClick={handleClear} />}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-[250px] p-0 rounded-xl" align="start">
                <Command className="rounded-xl">
                    {showSearch && (
                        <CommandInput
                            placeholder={searchPlaceholder}
                            className="h-9"
                        />
                    )}
                    <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        <CommandGroup>
                            {options.map(option => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => handleSelect(option.value)}
                                    className="cursor-pointer"
                                >
                                    {option.icon && <option.icon className="size-4 mr-2 text-muted-foreground" />}
                                    <span className="flex-1">{option.label}</span>
                                    <Check className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default AnimatedSelectButton;
