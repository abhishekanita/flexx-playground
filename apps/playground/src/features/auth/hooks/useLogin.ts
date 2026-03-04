import { API_URL } from '@/config';
import { useState } from 'react';
import { authApis } from '../services/auth.service';
import { useAuth } from '@/providers/auth.provider';
import { toast } from 'sonner';

export const useLogin = () => {
    const { setAuthToken, updateUser } = useAuth();
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [isOTPSent, setIsOTPSent] = useState(false);
    const [isLoading, setIsLoading] = useState({
        google: false,
        otp: false,
        login: false,
        resend: false,
    });

    const handleGoogleLogin = async () => {
        setIsLoading(p => ({ ...p, google: true }));
        window.location.href = `${API_URL}/api/v1/auth/google`;
    };

    const handleOTPSend = async () => {
        try {
            setIsLoading(p => ({ ...p, otp: true }));
            await authApis.sendOTP(phone);
            setIsOTPSent(true);
            setIsLoading(p => ({ ...p, otp: false }));
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to send OTP');
            console.log(err);
            setIsLoading(p => ({ ...p, otp: false }));
        }
    };

    const handleOTPLogin = async () => {
        try {
            setIsLoading(p => ({ ...p, login: true }));
            const { user, token } = await authApis.verifyOTP(phone, otp);
            if (user) {
                setAuthToken(token);
                updateUser(user);
            }
            setIsLoading(p => ({ ...p, login: false }));
        } catch (err) {
            toast.error('Invalid OTP');
            console.log(err);
            setIsLoading(p => ({ ...p, login: false }));
        }
    };

    const handlePhoneLogin = async () => {
        if (!isOTPSent) {
            handleOTPSend();
        } else {
            handleOTPLogin();
        }
    };

    const resendOTP = async () => {
        try {
            setIsLoading(p => ({ ...p, resend: true }));
            await authApis.sendOTP(phone);
            setIsLoading(p => ({ ...p, resend: false }));
            toast.success('OTP sent successfully');
        } catch (err) {
            setIsLoading(p => ({ ...p, resend: false }));
            console.log(err);
        }
    };

    const goBackToPhone = () => {
        setIsOTPSent(false);
        setOtp('');
    };

    return {
        phone,
        setPhone,
        otp,
        setOtp,
        isOTPSent,
        handleGoogleLogin,
        handlePhoneLogin,
        resendOTP,
        goBackToPhone,
        isLoading,
        isDisabled: isLoading.google || isLoading.otp || isLoading.login,
    };
};
