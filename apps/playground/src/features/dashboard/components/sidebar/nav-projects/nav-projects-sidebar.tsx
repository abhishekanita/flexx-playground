// import { SidebarContent } from '@/components/ui/sidebar';
// import { ChannelList } from 'stream-chat-react';
// import NavProjects from './nav-projects';
// import { useAuth } from '@/providers/auth.provider';
// import { useMemo } from 'react';

// const NavProjectsSidebar = () => {
//     const { user } = useAuth();

//     const FavList = useMemo(() => {
//         return (props: any) => <NavProjects {...props} title="Favorites" />;
//     }, []);

//     const AllList = useMemo(() => {
//         return (props: any) => <NavProjects {...props} title="Projects" />;
//     }, []);
//     return (
//         <SidebarContent className="gap-0">
//             <ChannelList
//                 List={FavList}
//                 filters={{
//                     title: {
//                         $exists: true,
//                     },
//                     members: {
//                         $in: [user?._id ?? ''],
//                     },
//                     team: user?.workplaceId,
//                 }}
//                 sendChannelsToList={true}
//                 setActiveChannelOnMount={false}
//                 channelRenderFilterFn={data => {
//                     return (
//                         data
//                             ?.filter(i => i?.data?.metadata?.pinned?.[user?._id])
//                             ?.filter(i => !i.data.metadata?.isDeleted) ?? []
//                     );
//                 }}
//             />
//             <ChannelList
//                 List={AllList}
//                 filters={{
//                     title: {
//                         $exists: true,
//                     },
//                     members: {
//                         $in: [user?._id ?? ''],
//                     },
//                     team: user?.workplaceId,
//                 }}
//                 sendChannelsToList={true}
//                 setActiveChannelOnMount={false}
//                 channelRenderFilterFn={data => {
//                     return data?.filter(i => !i.data.metadata?.isDeleted) ?? [];
//                 }}
//             />
//         </SidebarContent>
//     );
// };

// export default NavProjectsSidebar;
