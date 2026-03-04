import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import authRoutes from './auth';
import protectedRoutes from './protected';

function AppRoutes() {
    return (
        <AnimatePresence mode="wait" initial={false}>
            <RouterProvider router={createBrowserRouter([...protectedRoutes, ...authRoutes, ])} />
        </AnimatePresence>
    );
}

export default AppRoutes;
