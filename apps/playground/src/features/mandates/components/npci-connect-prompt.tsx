import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowLeftIcon, Banknote } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNPCIIntegration } from '@/features/integrations/hooks/useNPCIIntegration';

const variants = {
    hidden: { opacity: 0, x: -50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
};

interface NpciConnectPromptProps {
    onSuccess: () => void;
    initialPhoneNumber?: string;
}

export const NpciConnectPrompt = ({ onSuccess, initialPhoneNumber }: NpciConnectPromptProps) => {
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
        isLoading,
        isDisabled,
    } = useNPCIIntegration(initialPhoneNumber);

    const handleSubmit = async () => {
        if (!isOTPSent) {
            await handleSendOtp();
        } else {
            const success = await handleVerifyOtp();
            if (success) onSuccess();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center py-16 gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center justify-center size-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    <Banknote className="size-6" />
                </div>
                <h2 className="text-lg font-semibold mt-2">Connect NPCI UPI</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                    {isOTPSent
                        ? 'Enter the OTP sent to your phone to verify your identity.'
                        : 'Enter your phone number to view and manage your UPI autopay mandates.'}
                </p>
            </div>

            <div className="w-full max-w-sm flex flex-col gap-4">
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
        </div>
    );
};
