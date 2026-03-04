import AuthLayout from '../components/auth-layout';
import { Button } from '@/components/ui/button';
import { useLogin } from '../hooks/useLogin';
import { PhoneIcon } from 'lucide-react';
import { FaGoogle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PhoneLogin from '../components/email-login';

const SignupPage = () => {
    const navigate = useNavigate();
    const { handleGoogleLogin } = useLogin();
    const [isPhoneLogin, setIsPhoneLogin] = useState(false);
    const [direction, setDirection] = useState(1);

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 20 : -20,
            opacity: 0,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 20 : -20,
            opacity: 0,
        }),
    };

    const handlePhoneToggle = (isPhone: boolean) => {
        setDirection(isPhone ? 1 : -1);
        setIsPhoneLogin(isPhone);
    };

    return (
        <AuthLayout
            showPolicy={false}
            action={
                <Button variant="outline" size="lg" onClick={() => navigate('/')}>
                    Log in
                </Button>
            }
        >
            <div className="text-lg font-medium">{'Create your admin account'}</div>
            <div className="relative h-48">
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={isPhoneLogin ? 'phone' : 'social'}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: 'spring', stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 },
                        }}
                        className="grid gap-6 absolute w-full"
                    >
                        {isPhoneLogin ? (
                            <PhoneLogin handlePhoneToggle={handlePhoneToggle} isSignup={true} />
                        ) : (
                            <>
                                <Button onClick={() => handleGoogleLogin()} size="lg">
                                    <FaGoogle />
                                    Sign Up with Google
                                </Button>
                                <Button variant="outline" size="lg" onClick={() => handlePhoneToggle(true)}>
                                    <PhoneIcon className="size-4" />
                                    <span>Sign Up with Phone</span>
                                </Button>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </AuthLayout>
    );
};

export default SignupPage;
