import AuthLayout from '../components/auth-layout';
import { Button } from '@/components/ui/button';
import { useLogin } from '../hooks/useLogin';
import { FaGoogle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const navigate = useNavigate();
    const { handleGoogleLogin, isLoading, isDisabled } = useLogin();

    return (
        <AuthLayout
            showPolicy={false}
            action={
                <Button variant="outline" size="lg" onClick={() => navigate('/signup')}>
                    Create an account
                </Button>
            }
        >
            <div className="mb-10">
                <div className="text-5xl text-center font-medium font-instrument mb-4">Admin Dashboard</div>
                <div className="text-center font-medium">Sign in to manage your platform</div>
            </div>
            <div className="grid gap-6">
                <Button
                    onClick={() => handleGoogleLogin()}
                    size="lg"
                    disabled={isDisabled}
                    isLoading={isLoading.google}
                    className="text-white"
                >
                    <FaGoogle />
                    Sign In with Google
                </Button>
            </div>
        </AuthLayout>
    );
};

export default LoginPage;
