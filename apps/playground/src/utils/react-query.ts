import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

const queryConfig: QueryClientConfig = {
    defaultOptions: {
        queries: {
            staleTime: Infinity,
            // useErrorBoundary: false,
            refetchOnWindowFocus: true,
            retry: false,
            retryDelay: 10000,
        },
    },
};

export const queryClient = new QueryClient(queryConfig);
