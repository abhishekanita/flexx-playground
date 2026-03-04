import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useOutlet } from 'react-router-dom';

export const AnimatedOutlet: React.FC = () => {
    const outlet = useOutlet();

    const location = useLocation();
    const appKey = location.pathname.split('/')[1];

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={appKey}
                variants={{
                    initial: {
                        opacity: 0,
                        scale: 0.9,
                    },
                    animate: {
                        opacity: 1,
                        scale: 1,
                    },
                    exit: {
                        opacity: 0,
                        scale: 0.9,
                    },
                }}
                initial="initial"
                transition={{
                    duration: 0.3,
                }}
                animate="animate"
                exit="exit"
            >
                {outlet}
            </motion.div>
        </AnimatePresence>
    );
};
