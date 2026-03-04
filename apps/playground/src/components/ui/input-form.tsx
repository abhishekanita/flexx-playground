import * as React from 'react';

import { cn } from '@/utils/utils';
import { Label } from '@radix-ui/react-dropdown-menu';

function InputForm({
    className,
    type,
    label,
    description,
    isError,
    errorMessage,
    ...props
}: React.ComponentProps<'input'> & {
    label: string;
    description: string;
    isError: boolean;
    errorMessage: string;
}) {
    return (
        <div className={className}>
            <Label className="text-base font-medium">{label}</Label>
            <input
                type={type}
                data-slot="input"
                className={cn(
                    'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                    className,
                    isError ? 'border-destructive' : ''
                )}
                {...props}
            />
            <p className="text-xs text-muted-foreground">{description}</p>
            {isError && <p className="text-xs text-destructive">{errorMessage}</p>}
        </div>
    );
}

export { InputForm };
