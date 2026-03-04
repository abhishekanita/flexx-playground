import { atom, createStore } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import type { ReactNode } from 'react';

export const isCommandCenterOpenAtom = atom(false);
export const isNotificationOpenAtom = atom(false);
export const isInviteUserDialogOpenAtom = atom(false);
export const isSettingsDialogOpenAtom = atom(false);
export const selectedUserIdForDialog = atom('');
export const showCreateTaskDialog = atom(false);
export const isCreateWorkplaceDialogOpenAtom = atom(false);

export const chatPanelWidthAtom = atomWithStorage('chatPanelWidth', 40, null);
export const isPanelExpandedAtom = atom(false);

// Panel content management
export const panelContentAtom = atom<ReactNode | null>();

// Panel history management
export const panelHistoryStackAtom = atom<ReactNode[]>([]);
export const panelHistoryIndexAtom = atom<number>(-1);

export const dashboardStore = createStore();

dashboardStore.set(isCommandCenterOpenAtom, false);
dashboardStore.set(isNotificationOpenAtom, false);
dashboardStore.set(isInviteUserDialogOpenAtom, false);
dashboardStore.set(isSettingsDialogOpenAtom, false);
dashboardStore.set(selectedUserIdForDialog, '');
dashboardStore.set(isCreateWorkplaceDialogOpenAtom, false);
