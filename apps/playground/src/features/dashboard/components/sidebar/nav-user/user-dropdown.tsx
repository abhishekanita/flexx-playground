import { Blocks, LogOutIcon, Plus, Settings } from 'lucide-react';
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useMemo } from 'react';
import { useAuth } from '@/providers/auth.provider';
import { useNavigate } from 'react-router-dom';
import { isCreateWorkplaceDialogOpenAtom, isInviteUserDialogOpenAtom } from '@/features/dashboard/store/dashboard.store';
import { useSetAtom } from 'jotai';

const NavUserDropdownMenu = ({ onClose }: { onClose: () => void }) => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const setShowInviteUserDialog = useSetAtom(isInviteUserDialogOpenAtom);
    const setIsCreateWorkplaceDialogOpen = useSetAtom(isCreateWorkplaceDialogOpenAtom);

    return (
        <>
            <DropdownMenuContent className="w-54 rounded-md z-[1000]" align="start" side="bottom" sideOffset={4}>
                <div
                    className="gap-2 p-1  cursor-pointer hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                        onClose?.();
                        setIsCreateWorkplaceDialogOpen(true);
                    }}
                >
                    <div className=" text-xs flex items-center gap-2">
                        <Plus className="size-3" />
                        New workplace
                    </div>
                </div>
                <DropdownMenuSeparator />
                <div
                    className="gap-2 p-1  cursor-pointer hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                        onClose?.();
                        setShowInviteUserDialog(true);
                    }}
                >
                    <div className="  text-xs flex items-center gap-2">
                        <Plus className="size-3" />
                        Invite your friends
                    </div>
                </div>
                <div
                    className="gap-2 p-1 cursor-pointer hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                        onClose?.();
                        navigate('/app/settings/general');
                    }}
                >
                    <div className=" text-xs flex items-center gap-2">
                        <Settings className="size-3" />
                        Settings
                    </div>
                </div>
                <div
                    className="gap-2 p-1 cursor-pointer hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                        onClose?.();
                        navigate('/app/settings/integrations');
                    }}
                >
                    <div className=" text-xs flex items-center gap-2">
                        <Blocks className="size-3" />
                        Integrations
                    </div>
                </div>
                <DropdownMenuSeparator />
                <div className="gap-2 p-1 cursor-pointer hover:bg-primary/10 hover:text-primary" onClick={() => logout()}>
                    <div className="  text-xs flex items-center gap-2">
                        <LogOutIcon className="size-3" />
                        Sign out
                    </div>
                </div>
            </DropdownMenuContent>
        </>
    );
};

export default NavUserDropdownMenu;
