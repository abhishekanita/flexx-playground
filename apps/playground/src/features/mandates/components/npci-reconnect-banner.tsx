import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useNPCIIntegration } from '@/features/integrations/hooks/useNPCIIntegration';

interface NpciReconnectBannerProps {
    onSuccess: () => void;
    phoneNumber?: string;
}

export const NpciReconnectBanner = ({ onSuccess, phoneNumber }: NpciReconnectBannerProps) => {
    const [showOtp, setShowOtp] = useState(false);
    const { otp, setOtp, handleSendOtp, handleVerifyOtp, isLoading, isDisabled } =
        useNPCIIntegration(phoneNumber);

    const handleResync = async () => {
        await handleSendOtp();
        setShowOtp(true);
    };

    const handleVerify = async () => {
        const success = await handleVerifyOtp();
        if (success) {
            setShowOtp(false);
            onSuccess();
        }
    };

    return (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
            <div className="flex items-start gap-3">
                <RefreshCw className="size-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        Session expired
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        Your NPCI session has expired. Reconnect to sync latest mandates.
                    </p>

                    {showOtp ? (
                        <div className="flex items-center gap-3 mt-3">
                            <InputOTP
                                maxLength={6}
                                value={otp}
                                onChange={setOtp}
                                disabled={isDisabled}
                            >
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} className="size-9 border border-amber-300 dark:border-amber-800" />
                                    <InputOTPSlot index={1} className="size-9 border border-amber-300 dark:border-amber-800" />
                                    <InputOTPSlot index={2} className="size-9 border border-amber-300 dark:border-amber-800" />
                                    <InputOTPSlot index={3} className="size-9 border border-amber-300 dark:border-amber-800" />
                                    <InputOTPSlot index={4} className="size-9 border border-amber-300 dark:border-amber-800" />
                                    <InputOTPSlot index={5} className="size-9 border border-amber-300 dark:border-amber-800" />
                                </InputOTPGroup>
                            </InputOTP>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={handleVerify}
                                disabled={otp.length < 6 || isDisabled}
                                isLoading={isLoading.verify}
                            >
                                Verify
                            </Button>
                        </div>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 h-8 text-xs"
                            onClick={handleResync}
                            isLoading={isLoading.otp}
                            disabled={isDisabled}
                        >
                            <RefreshCw className="size-3" />
                            Resync Mandates
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
