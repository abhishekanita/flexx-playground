// import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton } from '@/components/ui/sidebar';
// import { motion, AnimatePresence } from 'framer-motion';
// import { useEffect, useState } from 'react';
// import { ChevronDown, EllipsisIcon, PlusIcon } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { type ChannelListMessengerProps } from 'stream-chat-react';
// import NavLoading from '../components/nav-loading';
// import { useLocalStorage } from '@/hooks/use-local-storage';
// import NavProjectItem from './nav-project-item';
// import CreateProjectDialog from '@/features/projects/components/create-project/create-project-dialog';
// import { cn } from '@/utils/utils';
// import { useSetAtom } from 'jotai';
// import { workplaceProjectsAtom } from '@/features/projects/store/project.store';

// interface NavProjectsProps extends ChannelListMessengerProps {
//     title?: string;
// }

// const NavProjects = (props: NavProjectsProps) => {
//     const [isOpen, setIsOpen] = useState(true);
//     const [numSkeleton, setNumSkeleton] = useLocalStorage('num-projects', 5);
//     const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
//     const [maxChannels, setMaxChannels] = useState(8);
//     const setWorkplaceProjects = useSetAtom(workplaceProjectsAtom);
//     const channels = props.loadedChannels?.filter(item => item.data?.title);
//     const isLoading = props.loading ?? false;
//     const showAll = () => {
//         setMaxChannels(p => (p === 8 ? channels?.length : 8));
//     };
//     useEffect(() => {
//         if (channels && numSkeleton !== channels.length) {
//             setNumSkeleton(channels.length);
//         }
//     }, [channels]);

//     useEffect(() => {
//         if (channels && channels.length > 0) {
//             const projects = channels.map(channel => ({
//                 id: channel.data?.id as string,
//                 slug: channel.data?.slug as string,
//                 title: channel.data?.title as string,
//                 icon: (channel.data?.icon as string) ?? 'hash',
//             }));
//             setWorkplaceProjects(projects);
//         }
//     }, [channels, setWorkplaceProjects]);

//     if ((!channels || channels.length === 0) && props.title === 'Favorites') return <></>;

//     return (
//         <SidebarGroup className="">
//             <SidebarGroupLabel
//                 className="flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/30 rounded-md py-0 group/folder"
//                 onClick={() => setIsOpen(p => !p)}
//             >
//                 <span className="font-medium flex items-center">
//                     {props.title || 'Projects'}
//                     <ArrowIcon isOpen={isOpen} />
//                 </span>
//                 <div className="flex items-center gap-1">
//                     <Button
//                         variant="ghost"
//                         size="icon"
//                         className="opacity-0 group-hover/folder:opacity-100 transition-opacity duration-300 hover:bg-white size-5 cursor-pointer hover:text-primary"
//                         onClick={e => {
//                             e.stopPropagation();
//                             setIsCreateProjectDialogOpen(true);
//                         }}
//                     >
//                         <PlusIcon className="size-3" />
//                     </Button>
//                 </div>
//             </SidebarGroupLabel>
//             <AnimatePresence>
//                 {isOpen && (
//                     <motion.div
//                         layout={false}
//                         initial={{ opacity: 0, height: 0 }}
//                         animate={{ opacity: 1, height: 'auto' }}
//                         exit={{ opacity: 0, height: 0 }}
//                         transition={{ duration: 0.1, ease: 'easeInOut' }}
//                     >
//                         <SidebarGroupContent>
//                             {isLoading ? (
//                                 <NavLoading num={7} />
//                             ) : (
//                                 <SidebarMenu className="gap-1">
//                                     {channels?.slice(0, maxChannels).map(item => (
//                                         <NavProjectItem key={item.id} item={item} showActive={true} />
//                                     ))}
//                                 </SidebarMenu>
//                             )}
//                         </SidebarGroupContent>
//                     </motion.div>
//                 )}
//             </AnimatePresence>
//             {(channels.length > maxChannels || maxChannels !== 8) && (
//                 <SidebarMenuButton asChild>
//                     <div className="" onClick={() => showAll()}>
//                         <span>
//                             <EllipsisIcon className="size-3" />
//                         </span>
//                         <span className="text-xs  font-medium -ms-1">More</span>
//                     </div>
//                 </SidebarMenuButton>
//             )}
//             <CreateProjectDialog isOpen={isCreateProjectDialogOpen} setIsOpen={setIsCreateProjectDialogOpen} />
//         </SidebarGroup>
//     );
// };

// export default NavProjects;

// const ArrowIcon = ({ isOpen }) => {
//     return (
//         <svg
//             className={cn(' transition-transform duration-150', isOpen ? 'rotate-90' : '')}
//             width="16"
//             height="16"
//             viewBox="0 0 16 16"
//             fill="lch(37.976% 1 282.863 / 1)"
//             role="img"
//             focusable="false"
//             aria-hidden="true"
//             xmlns="http://www.w3.org/2000/svg"
//         >
//             <path d="M7.00194 10.6239C6.66861 10.8183 6.25 10.5779 6.25 10.192V5.80802C6.25 5.42212 6.66861 5.18169 7.00194 5.37613L10.7596 7.56811C11.0904 7.76105 11.0904 8.23895 10.7596 8.43189L7.00194 10.6239Z"></path>
//         </svg>
//     );
// };
