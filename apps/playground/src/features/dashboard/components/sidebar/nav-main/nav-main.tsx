import { Search, Blocks, Banknote, TrendingUp } from 'lucide-react';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { isCommandCenterOpenAtom } from '../../../store/dashboard.store';

export function NavMain() {
    const { pathname } = useLocation();
    const setIsCommandCenterOpen = useSetAtom(isCommandCenterOpenAtom);
    const items = useMemo(
        () => [
            {
                id: 'inbox',
                title: 'Integrations',
                url: '/app/integrations',
                icon: Blocks,
                isActive: pathname === '/app/integrations',
            },
            {
                id: 'mandates',
                title: 'Mandates',
                url: '/app/mandates',
                icon: Banknote,
                isActive: pathname === '/app/mandates',
            },
            {
                id: 'mf-insights',
                title: 'Mutual Funds',
                url: '/app/mf-insights',
                icon: TrendingUp,
                isActive: pathname.startsWith('/app/mf-insights'),
            },
            {
                id: 'search',
                title: 'Search',
                onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.currentTarget.blur();
                    setIsCommandCenterOpen(true);
                },
                icon: Search,
            },
        ],
        [pathname]
    );

    return (
        <SidebarMenu>
            {items.map(item => (
                <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={item.isActive} className="">
                        {item.url ? (
                            <Link to={item.url} className="">
                                <div>
                                    <item.icon className="size-3.5" />
                                </div>
                                <span className="text-[13.8px]">{item.title}</span>
                            </Link>
                        ) : (
                            <span className="cursor-pointer" onClick={item.onClick}>
                                <div>
                                    <item.icon className="size-3.5" />
                                </div>
                                <span className="text-[13.8px]">{item.title}</span>
                            </span>
                        )}
                    </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );
}
