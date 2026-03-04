import { Button } from '@/components/ui/button';
import { PanelLeftIcon } from 'lucide-react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/utils/utils';

const MainPanelHeader = ({
    actions,
    children,
    breadcrumbs,
}: {
    actions?: React.ReactNode[];
    children?: React.ReactNode;
    breadcrumbs?: { label: string; to?: string; icon?: React.ReactNode }[];
}) => {
    const { toggleSidebar, open } = useSidebar();
    return (
        <div className={cn('sticky top-0 z-10 flex w-full items-center justify-between h-10')}>
            <div className="flex items-center justify-between  w-full h-full">
                <div className="flex items-center gap-4 justify-center">
                    {!open && (
                        <Button
                            data-sidebar="trigger"
                            data-slot="sidebar-trigger"
                            variant="ghost"
                            size="icon"
                            className={cn('size-7')}
                            onClick={() => {
                                toggleSidebar();
                            }}
                        >
                            <PanelLeftIcon />
                        </Button>
                    )}
                    {breadcrumbs && (
                        <Breadcrumb>
                            <BreadcrumbList className="flex items-center gap-0">
                                {breadcrumbs.map((i, index) => (
                                    <>
                                        <BreadcrumbItem className="hover:bg-primary/10 rounded-md px-2 py-1">
                                            <BreadcrumbLink asChild>
                                                {i.to ? (
                                                    <Link to={i.to}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="">{i?.icon}</span>
                                                            <h1 className="text-md font-medium truncate-md">{i.label}</h1>
                                                        </div>
                                                    </Link>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="">{i?.icon}</span>
                                                        <h1 className="text-md font-medium truncate-md">{i.label}</h1>
                                                    </div>
                                                )}
                                            </BreadcrumbLink>
                                        </BreadcrumbItem>
                                        {breadcrumbs.length - 1 > index && <BreadcrumbSeparator />}
                                    </>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                    )}
                </div>
                <div></div>
                <div className="flex items-center gap-2">{actions}</div>
            </div>
            {children}
        </div>
    );
};

export default MainPanelHeader;
