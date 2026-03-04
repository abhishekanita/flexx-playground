import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

export interface ConfirmOptions {
    title?: string;
    subtitle?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    type?: 'success' | 'error' | 'warning' | 'info';
    setOpen?: (open: boolean) => void;
    isLoading?: boolean;
}

type Props = ConfirmOptions & { open: boolean };

export function ConfirmDialog({
    open,
    title,
    subtitle,
    cancelText = 'Cancel',
    confirmText = 'Continue',
    onCancel,
    onConfirm,
    type = 'warning',
    isLoading,
    setOpen,
}: Props) {
    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{subtitle}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
