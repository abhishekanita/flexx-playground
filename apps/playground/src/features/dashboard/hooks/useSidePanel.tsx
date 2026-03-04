import { useAtom, useSetAtom } from 'jotai';
import {
    isPanelExpandedAtom,
    panelContentAtom,
    panelHistoryStackAtom,
    panelHistoryIndexAtom,
} from '../store/dashboard.store';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

export const useSidePanel = () => {
    const [isPanelExpanded, setIsPanelExpanded] = useAtom(isPanelExpandedAtom);
    const [panelContent, setPanelContent] = useAtom(panelContentAtom);
    const [historyStack, setHistoryStack] = useAtom(panelHistoryStackAtom);
    const [historyIndex, setHistoryIndex] = useAtom(panelHistoryIndexAtom);

    const canGoBack = useMemo(() => historyIndex > 0, [historyIndex]);
    const canGoForward = useMemo(
        () => historyIndex < historyStack.length - 1,
        [historyIndex, historyStack.length]
    );

    const showPanel = useCallback(
        (content: ReactNode) => {
            // If we're not at the end of history, slice off future entries
            const newStack = historyIndex === -1 ? [] : historyStack.slice(0, historyIndex + 1);

            // Add new content to history
            setHistoryStack([...newStack, content]);
            setHistoryIndex(newStack.length);

            // Show the content
            setPanelContent(content);
            setIsPanelExpanded(true);
        },
        [
            historyIndex,
            historyStack,
            setHistoryStack,
            setHistoryIndex,
            setPanelContent,
            setIsPanelExpanded,
        ]
    );

    const goBack = useCallback(() => {
        if (canGoBack) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setPanelContent(historyStack[newIndex]);
        }
    }, [canGoBack, historyIndex, historyStack, setHistoryIndex, setPanelContent]);

    const goForward = useCallback(() => {
        if (canGoForward) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setPanelContent(historyStack[newIndex]);
        }
    }, [canGoForward, historyIndex, historyStack, setHistoryIndex, setPanelContent]);

    const hidePanel = useCallback(() => {
        setIsPanelExpanded(false);
        // Clear content and history after animation
        setTimeout(() => {
            setPanelContent(null);
            setHistoryStack([]);
            setHistoryIndex(-1);
        }, 300);
    }, [setIsPanelExpanded, setPanelContent, setHistoryStack, setHistoryIndex]);

    return {
        showPanel,
        hidePanel,
        goBack,
        goForward,
        canGoBack,
        canGoForward,
        isPanelExpanded,
        panelContent,
    };
};
