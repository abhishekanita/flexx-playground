import { Sidebar, SidebarHeader } from '@/components/ui/sidebar';
import { NavMain } from './nav-main/nav-main';
import { NavUser } from './nav-user/nav-user';
import { useAuth } from '@/providers/auth.provider';
import { useLocation } from 'react-router-dom';
// import NavProjectsSidebar from './nav-projects/nav-projects-sidebar';
// import { NavProjectsInternal } from './nav-projects-internal/nav-projects-internal';
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileQuestionIcon, HelpCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavHelp from './components/nav-help';

export function AppSidebar({
    showProjectInternalNav,
    ...rest
}: React.ComponentProps<typeof Sidebar> & { showProjectInternalNav: boolean }) {
    return (
        <Sidebar className="border-r-0 " variant="inset" {...rest}>
            <SidebarHeader>
                <NavUser />
            </SidebarHeader>
            <div className="relative h-full overflow-y-auto">
                <motion.div
                    initial={false}
                    animate={{
                        x: showProjectInternalNav ? '-100%' : 0,
                        opacity: showProjectInternalNav ? 0 : 1,
                    }}
                    transition={{
                        x: { type: 'spring', stiffness: 300, damping: 30 },
                        opacity: { duration: 0 },
                    }}
                    className="absolute inset-0"
                >
                    <SidebarHeader>
                        <NavMain />
                    </SidebarHeader>
                    {/* <NavProjectsSidebar /> */}
                </motion.div>

                <motion.div
                    initial={false}
                    animate={{
                        x: showProjectInternalNav ? 0 : '100%',
                        opacity: showProjectInternalNav ? 1 : 0,
                    }}
                    transition={{
                        x: { type: 'spring', stiffness: 300, damping: 30 },
                        opacity: { duration: 0 },
                    }}
                    className="absolute inset-0"
                >
                    {/* <NavProjectsInternal /> */}
                </motion.div>
            </div>
            <NavHelp />
        </Sidebar>
    );
}
