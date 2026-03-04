import React from 'react';
import { useSidePanel } from '../../hooks/useSidePanel';
import { ChevronLeft, ChevronRight, XIcon } from 'lucide-react';
import { cn } from '@/utils/utils';

const SidePanelHeader = ({ children }) => {
    const { hidePanel, goBack, goForward, canGoBack, canGoForward } = useSidePanel();

    return (
        <div className="sticky top-0 z-10">
            <div className="h-10 flex items-center justify-between  px-3 border-b">
                <div className="flex flex-1 items-center gap-1">
                    <button
                        onClick={goBack}
                        disabled={!canGoBack}
                        className={cn(
                            'p-1.5 rounded-md transition-colors',
                            canGoBack
                                ? 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                : 'opacity-50 cursor-not-allowed'
                        )}
                        aria-label="Go back"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    {children}
                </div>
                <div>
                    <button
                        onClick={hidePanel}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Close panel"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SidePanelHeader;
