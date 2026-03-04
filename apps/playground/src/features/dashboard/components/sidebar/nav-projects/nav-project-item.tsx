import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useMemo, useState } from 'react';
import { DockIcon, EllipsisIcon, PhoneIcon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/utils/utils';
import { useAuth } from '@/providers/auth.provider';
import { useNavigationStore } from '@/features/dashboard/store/navigation.store';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import type { Channel } from 'stream-chat';
import { InlineDropdown, type DropdownOption } from '@/components/custom/inline-dropdown';
import { TbTrash } from 'react-icons/tb';
import { useProjectActions } from '@/features/projects/hooks/useProjectActions';

const NavProjectItem = ({ item, showActive }: { item: Channel; showActive?: boolean }) => {
    const { user } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { getProjectTab } = useNavigationStore();
    const isActive = useMemo(() => pathname.includes(item.data?.slug as string), [item.data?.slug, pathname]);
    const isActiveVideoCall = useMemo(() => {
        return false;
    }, []);

    const { deleteProject } = useProjectActions();

    const dropdownOptions: DropdownOption[] = [
        {
            key: 'a',
            label: 'Overview',
            icon: <DockIcon className="size-3" />,
            onClick: () => {
                navigate(`/app/project/${item.data.slug}/${getProjectTab(item.id!)}`);
            },
        },
        {
            key: 'delete',
            label: 'Delete Project',
            icon: <TbTrash className="text-base" />,
            type: 'delete',
            holdToConfirm: true,
            confirmLabel: 'Hold to Confirm',
            onClick: () => {
                deleteProject(item.id);
            },
        },
    ];

    return (
        <>
            <SidebarMenuItem>
                <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => {
                        navigate(`/app/project/${item.data.slug}/${getProjectTab(item.id!)}`);
                    }}
                >
                    <div
                        className={cn(
                            'flex items-center gap-2',
                            item.state.read[user?._id as string]?.unread_messages > 0 ? 'font-semibold ' : '!font-normal'
                        )}
                        onClick={e => {
                            e?.currentTarget?.blur();
                        }}
                    >
                        <span className="">
                            <DynamicIcon className="size-3.5 " name={(item?.data?.icon ?? 'hash') as IconName} />
                        </span>
                        <span className="text-[13.8px] ">{item.data?.title}</span>
                    </div>
                </SidebarMenuButton>
                {isActiveVideoCall && (
                    <SidebarMenuAction
                        showOnHover={false}
                        className="bg-transparent hover:bg-primary/10 text-sidebar-accent-foreground end-1 size-4 rounded-sm flex items-center justify-center cursor-pointer"
                    >
                        <div>
                            <PhoneIcon className="size-3 text-muted-foreground" fill="currentColor" />
                        </div>
                    </SidebarMenuAction>
                )}
                <SidebarMenuAction
                    showOnHover={false}
                    className="bg-transparent group-hover/menu-item:opacity-100 flex opacity-0 text-sidebar-accent-foreground end-1 size-4 rounded-sm  items-center justify-center cursor-pointer"
                >
                    <InlineDropdown options={dropdownOptions} contentClassName="rounded-xl " align="start">
                        <EllipsisIcon className="size-3 text-muted-foreground" />
                    </InlineDropdown>
                </SidebarMenuAction>
            </SidebarMenuItem>
        </>
    );
};

export default NavProjectItem;
