import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { TbHelp, TbLifebuoy, TbBook, TbMessageCircle, TbBrandGithub } from 'react-icons/tb';
import clsx from 'clsx';

interface HelpOption {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

const NavHelp = () => {
    const [isOpen, setIsOpen] = useState(false);
    const helpRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (helpRef.current && !helpRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const helpOptions: HelpOption[] = [
        {
            id: 'docs',
            label: 'Documentation',
            icon: <TbBook className="size-4" />,
            onClick: () => {
                window.open('https://docs.example.com', '_blank');
            },
        },
        {
            id: 'support',
            label: 'Get Support',
            icon: <TbLifebuoy className="size-4" />,
            onClick: () => {
                console.log('Support clicked');
            },
        },
        {
            id: 'feedback',
            label: 'Send Feedback',
            icon: <TbMessageCircle className="size-4" />,
            onClick: () => {
                console.log('Feedback clicked');
            },
        },
        {
            id: 'github',
            label: 'GitHub',
            icon: <TbBrandGithub className="size-4" />,
            onClick: () => {
                window.open('https://github.com', '_blank');
            },
        },
    ];

    return (
        <>
            <div className="absolute bottom-3 start-3 z-50" ref={helpRef}>
                <motion.div
                    animate={{
                        height: isOpen ? '160px' : '2rem',
                        width: isOpen ? '160px' : '2rem',
                        borderRadius: isOpen ? '10px' : '30px',
                    }}
                    transition={{ duration: 0.2, ease: 'linear' }}
                    className="border flex items-center justify-center  border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
                    onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOpen(p => !p);
                    }}
                >
                    {!isOpen && <div className="text-lg text-muted-foreground">{'?'}</div>}
                    {isOpen && (
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.1, ease: 'linear' }}
                            >
                                <div className="">
                                    {helpOptions.map((option, index) => (
                                        <motion.button
                                            key={option.id}
                                            onClick={() => {
                                                option.onClick();
                                                setIsOpen(false);
                                            }}
                                            className={clsx(
                                                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs transition-colors',
                                                'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                                                'text-neutral-700 dark:text-neutral-300'
                                            )}
                                        >
                                            {option.icon}
                                            <span>{option.label}</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    )}
                </motion.div>
            </div>
        </>
    );
};

export default NavHelp;
