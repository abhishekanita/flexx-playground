import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface ConfirmOptions {
    title?: string;
    subtitle?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    isLoading?: boolean;
    type?: 'success' | 'error' | 'warning' | 'info';
}

export type Nullable<T> = T | null;

export interface ConfirmContext {
    show: (options: Nullable<ConfirmOptions>) => Promise<boolean>;
}

export const ConfirmCtx = createContext<Nullable<ConfirmContext>>(null);

interface Props {
    children: ReactNode;
}

let resolveCallback: (response: boolean) => void;

export function ConfirmProvider({ children }: Props) {
    const [confirm, setConfirm] = useState<Nullable<ConfirmOptions>>(null);

    const [open, toggle] = useState(false);

    const show = useCallback(
        (confirmOptions: Nullable<ConfirmOptions>): Promise<boolean> => {
            setConfirm(confirmOptions);
            toggle(true);
            return new Promise(res => {
                resolveCallback = res;
            });
        },
        [toggle]
    );

    const onConfirm = () => {
        resolveCallback(true);
        toggle(false);
    };

    const onCancel = () => {
        resolveCallback(false);
        toggle(false);
    };

    const value = useMemo(() => ({ show }), [show]);

    return (
        <ConfirmCtx.Provider value={value}>
            <ConfirmDialog
                type="warning"
                {...confirm}
                onCancel={onCancel}
                onConfirm={onConfirm}
                open={open}
            />
            {children}
        </ConfirmCtx.Provider>
    );
}

export const useConfirm = () => {
    const context = useContext(ConfirmCtx);

    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }

    return context;
};
