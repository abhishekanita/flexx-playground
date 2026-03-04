import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type Theme = 'dark' | 'light' | 'system';
export type ColorTheme = (typeof themes)[number]['id'];

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    defaultColorTheme?: ColorTheme;
    storageKey?: string;
    colorThemeStorageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    colorTheme: ColorTheme;
    setColorTheme: (theme: ColorTheme) => void;
};

const initialState: ThemeProviderState = {
    theme: 'system',
    setTheme: () => null,
    colorTheme: 'modern',
    setColorTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = 'light',
    defaultColorTheme = 'modern',
    storageKey = 'intract-ui-theme',
    colorThemeStorageKey = 'intract-ui-color-theme',
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );
    const [colorTheme, setColorTheme] = useState<ColorTheme>(
        () => (localStorage.getItem(colorThemeStorageKey) as ColorTheme) || defaultColorTheme
    );
    const [isColorThemeTransitioning, setIsColorThemeTransitioning] = useState(false);

    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';

            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    useEffect(() => {
        const loadColorTheme = async () => {
            setIsColorThemeTransitioning(true);
            await new Promise(resolve => setTimeout(resolve, 100));

            const themeUrl = new URL(`../assets/css/themes/${colorTheme}.css`, import.meta.url)
                .href;

            // Remove existing theme stylesheet
            const existingLink = document.head.querySelector('link[data-theme-link]');
            if (existingLink) {
                document.head.removeChild(existingLink);
            }

            // Add new theme stylesheet
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = themeUrl;
            link.setAttribute('data-theme-link', 'true');

            // Wait for the stylesheet to load
            await new Promise<void>(resolve => {
                link.onload = () => resolve();
                link.onerror = () => resolve(); // Still resolve on error to prevent hanging
                document.head.appendChild(link);
            });

            // Small delay to ensure styles are applied
            await new Promise(resolve => setTimeout(resolve, 100));

            setIsColorThemeTransitioning(false);
        };

        loadColorTheme();

        return () => {
            // Cleanup on component unmount
            const linkToRemove = document.head.querySelector('link[data-theme-link]');
            if (linkToRemove) {
                document.head.removeChild(linkToRemove);
            }
        };
    }, [colorTheme]);

    const value = useMemo(
        () => ({
            theme,
            setTheme: (theme: Theme) => {
                localStorage.setItem(storageKey, theme);
                setTheme(theme);
            },
            colorTheme,
            setColorTheme: (colorTheme: ColorTheme) => {
                localStorage.setItem(colorThemeStorageKey, colorTheme);
                setColorTheme(colorTheme);
            },
        }),
        [theme, colorTheme]
    );

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeProviderContext);
}

export const themes = [
    {
        id: 'basics',
        name: 'Modern',
        description: 'A modern theme with a clean design',
        colors: [
            // 'primary',
            // 'destructive',
            // 'secondary',
            // 'accent',
            'oklch(0.7 0.17 28.12)',
            'oklch(0.57 0.2 26.34)',
            'oklch(0.81 0.15 71.81)',
            'oklch(0.64 0.22 28.93)',
        ],
    },
    {
        id: 'vs-code',
        name: 'VS Code',
        description: 'A theme inspired by VS Code',
        colors: [
            'oklch(0.71 0.15 239.15)',
            'oklch(0.61 0.24 20.96)',
            'oklch(0.91 0.03 229.2)',
            'oklch(0.88 0.02 235.72)',
        ],
    },
    {
        id: 'slack',
        name: 'Slack',
        description: 'A theme inspired by Slack',
        colors: [
            'oklch(0.37 0.14 323.4)',
            'oklch(0.59 0.22 11.39)',
            'oklch(0.96 0.01 311.36)',
            'oklch(0.88 0.02 323.34)',
        ],
    },
    {
        id: 'ghibli',
        name: 'Ghibli',
        description: 'A theme inspired by Studio Ghibli',
        colors: [
            'oklch(0.71 0.1 111.96)',
            'oklch(0.63 0.24 29.21)',
            'oklch(0.88 0.05 83.32)',
            'oklch(0.86 0.05 85.12)',
        ],
    },
    {
        id: 'claude',
        name: 'Claude',
        description: 'A theme inspired by Claude',
        colors: [
            'oklch(0.62 0.14 39.15)',
            'oklch(0.19 0 0)',
            'oklch(0.92 0.01 87.42)',
            'oklch(0.92 0.01 87.42)',
        ],
    },
];
