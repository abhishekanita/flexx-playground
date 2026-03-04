import { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

export const usePopupWindow = (
    options: {
        width?: number;
        height?: number;
        title?: string;
        features?: Record<string, string>;
        copyStyles?: boolean;
        onClose?: () => void;
        autoClose?: boolean;
    } = {}
) => {
    const {
        width = 400,
        height = 600,
        title = 'Popup Window',
        features = {},
        copyStyles = true,
        onClose = null,
        autoClose = true,
    } = options;

    const [popupWindow, setPopupWindow] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const popupRef = useRef(null);
    const reactRootRef = useRef(null);

    const defaultFeatures = {
        width,
        height,
        scrollbars: 'no',
        resizable: 'no',
        status: 'no',
        location: 'no',
        toolbar: 'no',
        menubar: 'no',
        ...features,
    };

    const copyStylesToPopup = useCallback(
        popup => {
            if (!copyStyles) return;

            const mainDocument = document;
            const popupDocument = popup.document;

            // Copy all stylesheets
            const stylesheets = mainDocument.querySelectorAll('link[rel="stylesheet"], style');
            stylesheets.forEach(stylesheet => {
                if (stylesheet.tagName === 'LINK') {
                    const newLink = popupDocument.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = (stylesheet as any).href;
                    newLink.type = 'text/css';
                    popupDocument.head.appendChild(newLink);
                } else if (stylesheet.tagName === 'STYLE') {
                    const newStyle = popupDocument.createElement('style');
                    newStyle.textContent = stylesheet.textContent;
                    popupDocument.head.appendChild(newStyle);
                }
            });

            // Copy Tailwind CSS if it exists
            const tailwindStyles =
                mainDocument.querySelector('style[data-vite-dev-id*="tailwind"]') ||
                mainDocument.querySelector('link[href*="tailwind"]');
            if (tailwindStyles) {
                if (tailwindStyles.tagName === 'LINK') {
                    const newLink = popupDocument.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = (tailwindStyles as any).href;
                    popupDocument.head.appendChild(newLink);
                } else {
                    const newStyle = popupDocument.createElement('style');
                    newStyle.textContent = tailwindStyles.textContent;
                    popupDocument.head.appendChild(newStyle);
                }
            }

            // Copy any CSS variables from :root
            const rootStyles = getComputedStyle(mainDocument.documentElement);
            let cssVariables = '';
            for (let i = 0; i < rootStyles.length; i++) {
                const property = rootStyles[i];
                if (property.startsWith('--')) {
                    cssVariables += `${property}: ${rootStyles.getPropertyValue(property)};`;
                }
            }

            if (cssVariables) {
                const variablesStyle = popupDocument.createElement('style');
                variablesStyle.textContent = `:root { ${cssVariables} }`;
                popupDocument.head.appendChild(variablesStyle);
            }
        },
        [copyStyles]
    );

    const openPopup = useCallback(
        (component, componentProps = {}) => {
            if (popupRef.current && !popupRef.current.closed) {
                console.log('popup already exists', popupRef.current);
                return popupRef.current; // Popup already exists
            }

            const featuresString = Object.entries(defaultFeatures)
                .map(([key, value]) => `${key}=${value}`)
                .join(',');

            // Open popup with about:blank
            const popup = window.open('about:blank', 'popupWindow', featuresString);

            if (!popup) {
                console.error('Failed to open popup - might be blocked by browser');
                return null;
            }

            popupRef.current = popup;
            setPopupWindow(popup);
            setIsOpen(true);

            // Write HTML structure to popup
            popup.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        overflow: hidden;
                    }
                    #root { 
                        width: 100vw; 
                        height: 100vh; 
                    }
                    * {
                        box-sizing: border-box;
                    }
                </style>
            </head>
            <body>
                <div id="root"></div>
            </body>
            </html>
        `);
            popup.document.close();

            // Wait for popup to load, then copy styles and render React
            setTimeout(() => {
                copyStylesToPopup(popup);
                renderReactComponentInPopup(popup, component, componentProps);
            }, 100);

            // Handle popup close
            popup.addEventListener('beforeunload', () => {
                handlePopupClose();
            });

            return popup;
        },
        [title, defaultFeatures, copyStylesToPopup]
    );

    const renderReactComponentInPopup = useCallback((popup, Component, props) => {
        console.log('rendering react component in popup', props);
        const popupDocument = popup.document;
        const rootElement = popupDocument.getElementById('root');

        if (!rootElement) {
            console.error('Root element not found in popup');
            return;
        }

        // Create React root and render component
        const root = createRoot(rootElement);
        reactRootRef.current = root;

        // Create a wrapper component that provides the popup context
        const PopupWrapper = () => {
            return (
                <div
                    style={{
                        width: '100vw',
                        height: '100vh',
                        overflow: 'hidden',
                    }}
                >
                    <Component {...props} />
                </div>
            );
        };

        root.render(<PopupWrapper />);
    }, []);

    const closePopup = useCallback(() => {
        if (reactRootRef.current) {
            reactRootRef.current.unmount();
            reactRootRef.current = null;
        }
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
        }
        handlePopupClose();
    }, []);

    const handlePopupClose = useCallback(() => {
        if (reactRootRef.current) {
            reactRootRef.current.unmount();
            reactRootRef.current = null;
        }
        setPopupWindow(null);
        setIsOpen(false);
        popupRef.current = null;

        if (onClose) {
            onClose();
        }
    }, [onClose]);

    // Monitor popup status
    useEffect(() => {
        if (!popupRef.current) return;

        const checkPopupStatus = setInterval(() => {
            if (popupRef.current && popupRef.current.closed) {
                handlePopupClose();
                clearInterval(checkPopupStatus);
            }
        }, 1000);

        return () => clearInterval(checkPopupStatus);
    }, [popupWindow, handlePopupClose]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (autoClose) {
                closePopup();
            }
        };
    }, [closePopup, autoClose]);

    return {
        popupWindow,
        isOpen,
        openPopup,
        closePopup,
        renderComponent: (component, props) => openPopup(component, props),
    };
};
