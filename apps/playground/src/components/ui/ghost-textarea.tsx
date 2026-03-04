import { cn } from '@/utils/utils';
import React, { useRef, useEffect } from 'react';

interface GhostTextAreaProps extends React.ComponentProps<'textarea'> {
    value?: string;
    maxLength?: number;
}

const GhostTextArea = ({ className, value, onChange, maxLength, ...rest }: GhostTextAreaProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    useEffect(() => {
        adjustHeight();
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            rows={1}
            data-limit-rows="true"
            className={cn(
                'flex leading-tight disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-[1.5px] border-input placeholder:text-muted-foreground/80 read-only:ring-0 read-only:focus:border-input border-none h-auto w-full resize-none rounded-none bg-transparent p-0 text-3xl!  font-medium break-words text-[#3F3F3F] outline-hidden dark:text-[#CFCFCF] transition-all duration-200 overflow-hidden',
                className
            )}
            value={value}
            maxLength={maxLength}
            onChange={e => {
                if (e.target?.value?.includes('\n')) return;
                if (maxLength && e.target.value.length > maxLength) {
                    e.target.value = e.target.value.slice(0, maxLength);
                }
                if (onChange) onChange(e);
                adjustHeight();
            }}
            onPaste={e => {
                if (maxLength) {
                    e.preventDefault();
                    const pasteText = e.clipboardData.getData('text');
                    const remaining = maxLength - value.length;
                    const toInsert = pasteText.slice(0, remaining);
                    const newValue = value + toInsert;
                    if (onChange) {
                        onChange({
                            ...e,
                            target: { ...e.target, value: newValue },
                        } as any);
                    }
                }
            }}
            {...rest}
        />
    );
};

export default GhostTextArea;
