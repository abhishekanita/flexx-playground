import { useEffect } from 'react';

interface UseFaviconOptions {
    defaultIcon?: string;
    unreadIcon?: string;
}

export const useFavicon = (
    unreadCount: number,
    { defaultIcon = '/logo.png', unreadIcon }: UseFaviconOptions = {}
) => {
    useEffect(() => {
        // Find existing favicon link element
        let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

        if (!faviconLink) {
            // Create favicon link if it doesn't exist
            faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            faviconLink.type = 'image/png';
            document.head.appendChild(faviconLink);
        }

        if (unreadCount > 0) {
            if (unreadIcon) {
                faviconLink.href = unreadIcon;
            }
            const originalTitle = document.title.replace(/^\(\d+\)\s/, '');
            document.title = `(${unreadCount}) ${originalTitle}`;
        } else {
            faviconLink.href = defaultIcon;

            const originalTitle = document.title.replace(/^\(\d+\)\s/, '');
            document.title = originalTitle;
        }
    }, [unreadCount, defaultIcon, unreadIcon]);
};
