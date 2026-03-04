import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeftIcon, PhoneIcon } from 'lucide-react';
import { useLogin } from '../hooks/useLogin';
import EmailOTP from './email-otp';
import { AnimatePresence, motion } from 'framer-motion';

const PhoneLogin = ({
    handlePhoneToggle,
    isSignup,
    disabled,
}: {
    handlePhoneToggle: (isPhone: boolean) => void;
    isSignup?: boolean;
    disabled?: boolean;
}) => {
    const {
        phone,
        setPhone,
        otp,
        setOtp,
        handlePhoneLogin,
        isOTPSent,
        resendOTP,
        goBackToPhone,
        isDisabled: isDisabledLogin,
        isLoading,
    } = useLogin();

    const variants = {
        hidden: { opacity: 0, x: -50 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 50 },
    };

    const isDisabled = disabled || isDisabledLogin;

    return (
        <div className="flex flex-col gap-4 w-full">
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
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
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
                        className="flex flex-col gap-4 items- w-full mb-5"
                    >
                        <p className="text-sm text-center text-muted-foreground">
                            Enter the 6-digit code sent to{' '}
                            <span className="font-semibold text-foreground">{phone}</span>
                        </p>
                        <EmailOTP otp={otp} setOtp={setOtp} disabled={isDisabled} />
                        <div className="flex justify-between w-full text-xs text-muted-foreground">
                            <button
                                onClick={resendOTP}
                                className="hover:underline flex items-center gap-1"
                            >
                                Didn't receive the code? Resend Code
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button
                variant="outline"
                size="lg"
                onClick={() => handlePhoneLogin()}
                disabled={isDisabled}
                isLoading={isLoading.otp || isLoading.login}
            >
                <PhoneIcon className="size-4" />
                <span>{isSignup ? 'Sign Up with Phone' : 'Sign In with Phone'}</span>
            </Button>
            <div
                onClick={() => (isOTPSent ? goBackToPhone() : handlePhoneToggle(false))}
                className="text-xs text-muted-foreground p-0 m-0 cursor-pointer text-center hover:underline flex items-center justify-center gap-1"
            >
                <ArrowLeftIcon className="size-3" />
                <span>Back</span>
            </div>
        </div>
    );
};

export default PhoneLogin;
