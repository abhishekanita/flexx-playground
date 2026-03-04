import { ChevronsLeftIcon, DockIcon, FilterIcon, PlusIcon, SortAscIcon } from 'lucide-react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
// import { useArtifacts } from '@/features/artifacts/hooks/artifacts/useArtifacts';
import { DynamicIcon } from 'lucide-react/dynamic';

export function NavProjectsInternal() {
    // const { artifacts, handleArtifactClick } = useArtifacts();

    return <></>;
    // return (
    //     <>
    //         <>
    //             <SidebarGroup className="">
    //                 <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/30 rounded-md py-0 group/folder mb-3">
    //                     <span className="font-medium text-sm">{'Project Artifacts'}</span>
    //                     <div className="flex items-center gap-1">
    //                         <Button
    //                             variant="ghost"
    //                             size="icon"
    //                             className="opacity-0 group-hover/folder:opacity-100 transition-opacity duration-300 hover:bg-white size-5 cursor-pointer hover:text-primary"
    //                             onClick={e => {}}
    //                         >
    //                             <PlusIcon className="size-3" />
    //                         </Button>
    //                     </div>
    //                 </SidebarGroupLabel>
    //                 <div className="flex gap-2 mb-4">
    //                     <Button className="rounded-2xl px-4 py-2 text-xs h-8" variant="outline">
    //                         <FilterIcon className="text-muted-foreground -me-1 size-3" />
    //                         Filters
    //                     </Button>
    //                     <Button className="rounded-2xl px-4 py-2 text-xs h-8" variant="outline">
    //                         <SortAscIcon className="text-muted-foreground -me-1 size-3" />
    //                         Sort
    //                     </Button>
    //                 </div>
    //                 <>
    //                     {(artifacts || []).map(i => (
    //                         <SidebarMenu className="mb-1">
    //                             <SidebarMenuItem>
    //                                 <Button
    //                                     className="w-full py-5 flex items-center justify-start ps-2"
    //                                     variant="ghost"
    //                                     onClick={() => handleArtifactClick(i)}
    //                                 >
    //                                     <div className="cursor-pointer  flex items-center justify-center">
    //                                         <span className="me-2 size-6 bg-primary/10 rounded border shrink-0 flex items-center justify-center">
    //                                             <DynamicIcon
    //                                                 name="file-code"
    //                                                 className="size-3.5 text-primary"
    //                                             />
    //                                         </span>
    //                                         <div className="text-sm font-normal truncate">
    //                                             {i.name || 'Untitled'}
    //                                         </div>
    //                                     </div>
    //                                 </Button>
    //                             </SidebarMenuItem>
    //                         </SidebarMenu>
    //                     ))}
    //                 </>
    //             </SidebarGroup>
    //         </>
    //     </>
    // );
}
