import { Outlet, Link, useLocation } from 'react-router-dom';
import { BarChart3, Lightbulb, FolderOpen, PanelLeftIcon } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import Panels from '@/features/dashboard/components/panels/panels';
import { cn } from '@/utils/utils';

const TABS = [
    { label: 'Dashboard', path: '/app/mf-insights', icon: BarChart3 },
    { label: 'Insights', path: '/app/mf-insights/insights', icon: Lightbulb },
    { label: 'Funds', path: '/app/mf-insights/funds', icon: FolderOpen },
];

export function MFLayout() {
    const { pathname } = useLocation();
    const { toggleSidebar, open } = useSidebar();

    return (
        <Panels>
            <div className="h-full flex flex-col bg-[#f5f5f4] dark:bg-background noise-bg">
                {/* Header */}
                <div className="sticky top-0 z-20 bg-[#f5f5f4]/80 backdrop-blur-xl dark:bg-background/80 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <div className="flex items-center gap-3 px-8 pt-5 pb-3">
                        {!open && (
                            <Button
                                data-sidebar="trigger"
                                data-slot="sidebar-trigger"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={toggleSidebar}
                            >
                                <PanelLeftIcon />
                            </Button>
                        )}
                        <h1 className="text-[17px] font-semibold tracking-tight text-foreground/90">Mutual Funds</h1>
                    </div>

                    {/* Pill tab navigation */}
                    <div className="flex items-center gap-1 px-8 pb-3">
                        {TABS.map(tab => {
                            const isActive = pathname === tab.path;
                            return (
                                <Link
                                    key={tab.path}
                                    to={tab.path}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium transition-all rounded-lg',
                                        isActive
                                            ? 'bg-white dark:bg-white/10 text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)]'
                                            : 'text-muted-foreground/70 hover:text-foreground/80 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                                    )}
                                >
                                    <tab.icon className="size-3.5" />
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto relative z-10">
                    <Outlet />
                </div>
            </div>
        </Panels>
    );
}
