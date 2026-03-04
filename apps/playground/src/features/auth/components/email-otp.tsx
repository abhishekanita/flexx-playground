import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const EmailOTP = ({
    otp,
    setOtp,
    disabled,
}: {
    otp: string;
    setOtp: (otp: string) => void;
    disabled?: boolean;
}) => {
    return (
        <InputOTP
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e)}
            className="w-full"
            disabled={disabled}
        >
            <InputOTPGroup className="">
                <InputOTPSlot index={0} className="size-14 border border-primary/30" />
                <InputOTPSlot index={1} className="size-14 border border-primary/30" />
                <InputOTPSlot index={2} className="size-14 border border-primary/30" />
                <InputOTPSlot index={3} className="size-14 border border-primary/30" />
                <InputOTPSlot index={4} className="size-14 border border-primary/30" />
                <InputOTPSlot index={5} className="size-14 border border-primary/30" />
            </InputOTPGroup>
        </InputOTP>
    );
};

export default EmailOTP;
