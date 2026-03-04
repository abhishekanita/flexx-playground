import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/utils';
import MainPanel from './main-panel';
import SidePanel from './side-panel';
import { useAtom } from 'jotai';
import { isPanelExpandedAtom } from '../../store/dashboard.store';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useLocalStorage } from '@/hooks/use-local-storage';

const Panels = ({ children }: { children: React.ReactNode }) => {
    const mainRef = useRef<ImperativePanelHandle>(null);
    const chatRef = useRef<ImperativePanelHandle>(null);
    const [chatPanelWidth, setChatPanelWidth] = useLocalStorage('chat-panel-width', 40);
    const [isPanelExpanded, setIsPanelExpanded] = useAtom(isPanelExpandedAtom);
    const lastWidthRef = useRef(chatPanelWidth);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (chatPanelWidth === 0) {
            lastWidthRef.current = 0;
            return;
        }
        if (chatPanelWidth <= 20) {
            lastWidthRef.current = 40;
        } else {
            lastWidthRef.current = chatPanelWidth;
        }
    }, [chatPanelWidth]);

    useEffect(() => {
        if (!lastWidthRef.current && lastWidthRef.current !== 0) return;
        if (isPanelExpanded) {
            const width = lastWidthRef.current > 0 ? lastWidthRef.current : 40;
            setChatPanelWidth(width);
            mainRef.current?.resize(100 - width);
            chatRef.current?.resize(width);
        } else {
            setChatPanelWidth(0);
            mainRef.current?.resize(100);
            chatRef.current?.resize(0);
        }
    }, [isPanelExpanded]);

    return (
        <ResizablePanelGroup direction="horizontal" className="bg-sidebar h-full ">
            <ResizablePanel
                defaultSize={100 - chatPanelWidth}
                className={cn(
                    `bg-white dark:bg-background rounded-lg me-0.5 shadow-none border border-border  relative`,
                    isDragging ? 'transition-none' : 'transition-all duration-100 ease-in-out h-full'
                )}
                minSize={50}
                ref={mainRef}
                collapsible={false}
                style={{
                    height: '100%',
                }}
            >
                <MainPanel>{children}</MainPanel>
            </ResizablePanel>
            {chatPanelWidth > 0 && (
                <>
                    <ResizableHandle
                        withHandle
                        className="bg-primary/0 transition-all duration-100 ease-in-out"
                        data-slot="resizable-handle"
                        onDragging={() => {
                            setIsDragging(p => !p);
                        }}
                    />
                </>
            )}
            <ResizablePanel
                defaultSize={chatPanelWidth}
                className={cn(
                    'bg-primary-foreground dark:bg-background  border rounded-lg ms-0.5 h-full ',
                    isDragging ? 'transition-none' : 'transition-all duration-300 ease-in-out',
                    chatPanelWidth === 0 ? 'opacity-0' : 'opacity-100'
                )}
                onResize={e => setChatPanelWidth(e)}
                onCollapse={() => setIsPanelExpanded(false)}
                ref={chatRef}
                collapsible
                minSize={20}
                style={{
                    height: '100%',
                }}
            >
                <SidePanel />
            </ResizablePanel>
        </ResizablePanelGroup>
    );
};

export default Panels;
