import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface NavigationState {
    projectNavigationState: Record<string, string>;
    setProjectTab: (projectId: string, tab: string) => void;
    getProjectTab: (projectId: string) => string;
}

export const useNavigationStore = create<NavigationState>()(
    devtools(
        persist(
            immer((set, get) => ({
                projectNavigationState: {},

                setProjectTab: (projectId: string, tab: string) => {
                    set(state => {
                        state.projectNavigationState[projectId] = tab;
                    });
                },

                getProjectTab: (projectId: string) => {
                    return 'chat';
                    return get().projectNavigationState[projectId] || 'overview';
                },
            })),
            {
                name: 'navigation-store',
                partialize: state => ({ projectNavigationState: state.projectNavigationState }),
            }
        ),
        { name: 'navigation-store' }
    )
);
