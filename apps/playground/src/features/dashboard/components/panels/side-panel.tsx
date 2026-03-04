import { useAtomValue } from 'jotai';
import { panelContentAtom } from '../../store/dashboard.store';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSidePanel } from '../../hooks/useSidePanel';
import { cn } from '@/utils/utils';

const SidePanel = () => {
    const panelContent = useAtomValue(panelContentAtom);

    return <div className="h-full relative flex flex-col bg-white dark:bg-background">{panelContent}</div>;
};

export default SidePanel;
