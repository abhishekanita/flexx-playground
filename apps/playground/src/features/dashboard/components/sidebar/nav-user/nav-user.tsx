import { BellIcon, ChevronDown, SearchIcon, SquarePen } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import NavUserDropdownMenu from './user-dropdown';
import { useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { showCreateTaskDialog } from '@/features/dashboard/store/dashboard.store';
import { useAuth } from '@/providers/auth.provider';
import { useNavigate } from 'react-router-dom';

export function NavUser() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const createNewTask = useSetAtom(showCreateTaskDialog);

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                        <div className="flex items-center justify-between ">
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton className="flex items-center px-1.5 gap-2  bg-primary/0 hover:bg-primary/10">
                                    <div className=" text-sidebar-primary-foreground shrink-0  flex aspect-square size-5.5 border items-center justify-center rounded-md overflow-hidden">
                                        <span className="text-xs bg-amber-600 h-full w-full flex items-center justify-center uppercase">
                                            A
                                        </span>
                                    </div>
                                    <span className="truncate font-medium text-md">Abhishek</span>
                                    <ChevronDown className="opacity-50 size-4 " />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <div className="me-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-xl size-7 hover:bg-accent-foreground/10"
                                    onClick={e => {
                                        e.stopPropagation();
                                        navigate('/app/notifications');
                                    }}
                                >
                                    <BellIcon className="size-3.5 " />
                                </Button>
                            </div>
                            <div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-xl size-7"
                                    onClick={e => {
                                        e.stopPropagation();
                                        createNewTask(true);
                                    }}
                                >
                                    <SquarePen className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                        <NavUserDropdownMenu onClose={() => setIsDropdownOpen(false)} />
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>
        </>
    );
}
