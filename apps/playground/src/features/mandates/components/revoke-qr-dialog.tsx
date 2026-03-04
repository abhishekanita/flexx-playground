import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Subscription, RevokeResult } from '../types/mandate.type';

const UPI_APPS = [
    { value: 'PAYTM', label: 'Paytm' },
    { value: 'GOOGLE_PAY', label: 'Google Pay' },
    { value: 'PHONEPE', label: 'PhonePe' },
    { value: 'BHIM', label: 'BHIM' },
    { value: 'CRED', label: 'CRED' },
    { value: 'AMAZON_PAY', label: 'Amazon Pay' },
    { value: 'WHATSAPP', label: 'WhatsApp' },
] as const;

interface RevokeQrDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subscription: Subscription | null;
    revokeResult: RevokeResult | null;
    onRevoke: (umn: string, app: string) => Promise<RevokeResult | null>;
    isRevoking: boolean;
}

export const RevokeQrDialog = ({
    open,
    onOpenChange,
    subscription,
    revokeResult,
    onRevoke,
    isRevoking,
}: RevokeQrDialogProps) => {
    const [selectedApp, setSelectedApp] = useState<string>('GOOGLE_PAY');

    if (!subscription || !subscription.mandate) return null;

    const { mandate } = subscription;

    const handleRevoke = async () => {
        await onRevoke(mandate.umn, selectedApp);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Cancel Subscription</DialogTitle>
                    <DialogDescription>
                        Revoke autopay for <span className="font-semibold text-foreground">{subscription.name}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-medium">
                                {new Intl.NumberFormat('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 0,
                                }).format(subscription.amount)}/{subscription.billingCycle.toLowerCase()}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">UPI Payee</span>
                            <span className="font-medium">{mandate.payeeName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Category</span>
                            <span className="font-medium">{mandate.category}</span>
                        </div>
                    </div>

                    {!revokeResult ? (
                        <div className="flex flex-col gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm text-muted-foreground">UPI App</label>
                                <Select value={selectedApp} onValueChange={setSelectedApp}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {UPI_APPS.map(app => (
                                            <SelectItem key={app.value} value={app.value}>
                                                {app.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={handleRevoke}
                                disabled={isRevoking}
                                isLoading={isRevoking}
                            >
                                Generate Revoke QR
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="bg-white p-4 rounded-lg">
                                <QRCodeSVG value={revokeResult.intentUrl} size={200} />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Scan this QR code with your UPI app to complete the revocation.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
