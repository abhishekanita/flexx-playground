import AuthLayout from '../components/auth-layout';
import { Button } from '@/components/ui/button';
import { MailIcon } from 'lucide-react';
import { FaGoogle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useOAuthCallback } from '../hooks/useOAuthCallback';

const CallbackPage = () => {
    const navigate = useNavigate();
    useOAuthCallback();

    return (
        <AuthLayout
            showPolicy={false}
            action={
                <Button variant="outline" size="lg" onClick={() => navigate('/signup')}>
                    Create an account
                </Button>
            }
        >
            <div className="text-lg text-center font-medium">Log in to Spotlight</div>
            <div className="relative h-48">
                <div className="grid gap-6 absolute w-full">
                    <Button size="lg" disabled={true} isLoading={true}>
                        <FaGoogle />
                        Sign In with Google
                    </Button>
                    <Button variant="outline" size="lg" disabled={true}>
                        <MailIcon className="size-4" />
                        <span>Sign In with Email</span>
                    </Button>
                </div>
            </div>
        </AuthLayout>
    );
};

export default CallbackPage;
