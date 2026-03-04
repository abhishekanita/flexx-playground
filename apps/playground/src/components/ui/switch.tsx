import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@/utils/utils';

function Switch({
    className,
    size,
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
    size?: 'sm' | 'lg';
}) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                'peer data-[state=checked]:bg-primary focus-visible:ring-[3px] data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none  disabled:cursor-not-allowed disabled:opacity-50',
                size === 'sm' ? 'h-[0.9rem] w-5.5' : 'h-[1.15rem] w-8  ',
                className
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block  rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0',
                    size === 'sm' ? 'size-2.5' : 'size-4'
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
