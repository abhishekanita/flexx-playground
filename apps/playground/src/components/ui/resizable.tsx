import * as React from 'react';
import { GripVerticalIcon } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '@/utils/utils';

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
    return (
        <ResizablePrimitive.PanelGroup
            data-slot="resizable-panel-group"
            className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
            {...props}
        />
    );
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
    return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
    withHandle,
    className,
    ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
    withHandle?: boolean;
}) {
    return (
        <ResizablePrimitive.PanelResizeHandle
            data-slot="resizable-handle"
            className={cn(
                'bg-border focus-visible:ring-ring relative flex w-px items-center group justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90',
                className
            )}
            {...props}
        >
            {withHandle && (
                <div className="bg-border z-10 flex h-10 w-3 items-center justify-center rounded-xs border border-border group-hover:border-primary/50 group-hover:scale-y-110 group-data-resize-handle-active:border-primary group-data-resize-handle-active:scale-y-200 group-data-resize-handle-active:bg-primary/10 transition-all duration-200">
                    <GripVerticalIcon className="size-3.5 text-primary group-hover:text-primary group-data-resize-handle-active:text-primary" />
                </div>
            )}
        </ResizablePrimitive.PanelResizeHandle>
    );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
