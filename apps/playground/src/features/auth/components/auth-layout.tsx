import { motion } from 'framer-motion';
import React from 'react';
import logo from '@/assets/images/logo.png';

const AuthLayout = ({
    children,
    showPolicy = true,
    action,
}: {
    children: React.ReactNode;
    showPolicy?: boolean;
    action?: React.ReactNode;
}) => {
    return (
        <div className="relative flex h-screen w-full flex-col items-center justify-center">
            <div className="z-20 flex w-full flex-row items-center justify-between px-8 pt-6">
                <div className="flex flex-row items-center justify-center space-x-2">
                    <img alt="logo" className="h-10 w-10 " src={logo} />
                </div>
                <div>{action}</div>
            </div>
            <div className="flex-1"></div>
            <div className="flex w-full flex-row flex-wrap items-center justify-between gap-2 px-8 pb-6">
                <div className="text-sm">The single platform to collaborate and grow your companies.</div>
                <div className="subtle text-xs">© 2025. the cohack. All rights reserved.</div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-0 flex items-center justify-center overflow-hidden">
                <span className="mx-auto block select-none whitespace-nowrap text-center text-[clamp(8rem,24vw,14rem)] font-black uppercase tracking-[1.25rem] text-black/5 leading-none dark:text-white/10">
                    MOMENTUM
                </span>
            </div>
            <div className="absolute top-0 right-0 bottom-0 left-0 z-10">
                <div className="flex h-full w-full flex-col items-center justify-center">
                    <div className="p-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.88 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="mx-auto flex w-[350px] flex-col justify-center space-y-6"
                        >
                            {children}
                            {showPolicy && (
                                <p className="subtle px-8 text-center text-xs">
                                    By using the hub, you are agreeing to our
                                    <br />
                                    <a target="_blank" className="hover:text-primary underline underline-offset-4">
                                        Terms of Service
                                    </a>
                                    <span className="mx-1">and</span>
                                    <a target="_blank" className="hover:text-primary underline underline-offset-4">
                                        Privacy Policy
                                    </a>
                                    .
                                </p>
                            )}
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
