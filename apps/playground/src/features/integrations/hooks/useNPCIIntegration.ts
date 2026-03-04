import { useState } from 'react';
import { integrationsApis } from '../services/integrations.service';
import { toast } from 'sonner';

export const useNPCIIntegration = (initialPhoneNumber?: string) => {
    const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
    const [otp, setOtp] = useState('');
    const [isOTPSent, setIsOTPSent] = useState(false);
    const [isLoading, setIsLoading] = useState({
        otp: false,
        verify: false,
        resend: false,
    });

    const handleSendOtp = async () => {
        try {
            setIsLoading(p => ({ ...p, otp: true }));
            await integrationsApis.initiateNpciIntegration(phoneNumber);
            setIsOTPSent(true);
            setIsLoading(p => ({ ...p, otp: false }));
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to send OTP');
            setIsLoading(p => ({ ...p, otp: false }));
        }
    };

    const handleVerifyOtp = async () => {
        try {
            setIsLoading(p => ({ ...p, verify: true }));
            await integrationsApis.completeNpciIntegration(phoneNumber, otp);
            toast.success('NPCI UPI connected successfully');
            setIsLoading(p => ({ ...p, verify: false }));
            return true;
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Invalid OTP');
            setIsLoading(p => ({ ...p, verify: false }));
            return false;
        }
    };

    const resendOtp = async () => {
        try {
            setIsLoading(p => ({ ...p, resend: true }));
            await integrationsApis.initiateNpciIntegration(phoneNumber);
            setIsLoading(p => ({ ...p, resend: false }));
            toast.success('OTP sent successfully');
        } catch (err) {
            setIsLoading(p => ({ ...p, resend: false }));
        }
    };

    const goBackToPhone = () => {
        setIsOTPSent(false);
        setOtp('');
    };

    const reset = () => {
        setPhoneNumber('');
        setOtp('');
        setIsOTPSent(false);
    };

    return {
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
        isDisabled: isLoading.otp || isLoading.verify,
    };
};
