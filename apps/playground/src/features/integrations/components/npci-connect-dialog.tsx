import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowLeftIcon, Banknote } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNPCIIntegration } from '../hooks/useNPCIIntegration';

interface NpciConnectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const variants = {
    hidden: { opacity: 0, x: -50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
};

export const NpciConnectDialog = ({ open, onOpenChange, onSuccess }: NpciConnectDialogProps) => {
    const {
        phoneNumber,
        setPhoneNumber,
        otp,
        setOtp,
        isOTPSent,
        handleSendOtp,
        handleVerifyOtp,
        resendOtp,
        goBackToPhone,
        reset,
        isLoading,
        isDisabled,
    } = useNPCIIntegration();

    const handleClose = (open: boolean) => {
        if (!open) reset();
        onOpenChange(open);
    };

    const handleSubmit = async () => {
        if (!isOTPSent) {
            await handleSendOtp();
        } else {
            const success = await handleVerifyOtp();
            if (success) {
                reset();
                onOpenChange(false);
                onSuccess();
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Banknote className="size-5" />
                        Connect NPCI UPI
                    </DialogTitle>
                    <DialogDescription>
                        {isOTPSent
                            ? 'Enter the OTP sent to your phone'
                            : 'Enter your phone number to connect your UPI account'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <AnimatePresence mode="wait">
                        {!isOTPSent ? (
                            <motion.div
                                key="phone-input"
                                variants={variants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                transition={{ duration: 0.3 }}
                                className="w-full"
                            >
                                <Input
                                    placeholder="Phone Number (e.g., 919876543210)"
                                    className="h-10 rounded-md px-6 has-[>svg]:px-4 border"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    disabled={isDisabled}
                                    type="tel"
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="otp-input"
                                variants={variants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                transition={{ duration: 0.3 }}
                                className="flex flex-col gap-4 items-center w-full"
                            >
                                <p className="text-sm text-center text-muted-foreground">
                                    Enter the 6-digit code sent to{' '}
                                    <span className="font-semibold text-foreground">{phoneNumber}</span>
                                </p>
                                <InputOTP
                                    maxLength={6}
                                    value={otp}
                                    onChange={e => setOtp(e)}
                                    className="w-full"
                                    disabled={isDisabled}
                                >
                                    <InputOTPGroup>
                                        <InputOTPSlot index={0} className="size-14 border border-primary/30" />
                                        <InputOTPSlot index={1} className="size-14 border border-primary/30" />
                                        <InputOTPSlot index={2} className="size-14 border border-primary/30" />
                                        <InputOTPSlot index={3} className="size-14 border border-primary/30" />
                                        <InputOTPSlot index={4} className="size-14 border border-primary/30" />
                                        <InputOTPSlot index={5} className="size-14 border border-primary/30" />
                                    </InputOTPGroup>
                                </InputOTP>
                                <div className="flex justify-between w-full text-xs text-muted-foreground">
                                    <button onClick={resendOtp} className="hover:underline flex items-center gap-1">
                                        Didn't receive the code? Resend Code
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Button
                        variant="outline"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={isDisabled}
                        isLoading={isLoading.otp || isLoading.verify}
                    >
                        <Banknote className="size-4" />
                        <span>{isOTPSent ? 'Verify & Connect' : 'Send OTP'}</span>
                    </Button>

                    {isOTPSent && (
                        <div
                            onClick={goBackToPhone}
                            className="text-xs text-muted-foreground cursor-pointer text-center hover:underline flex items-center justify-center gap-1"
                        >
                            <ArrowLeftIcon className="size-3" />
                            <span>Back</span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
