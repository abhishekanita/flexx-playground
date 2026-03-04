import { clsx, type ClassValue } from 'clsx';
import moment from 'moment';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    return moment(new Date(date)).format('MMM dd, yyyy');
};

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const stripMarkdown = (markdown: string): string => {
    if (!markdown) return '';
    try {
        return markdown
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Remove images, keep alt
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
            .replace(/#{1,6}\s+/g, '') // Remove headers
            .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
            .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
            .replace(/`{3}[\s\S]*?`{3}/g, '') // Remove code blocks
            .replace(/`([^`]+)`/g, '$1') // Remove inline code
            .replace(/^\s*[-+*]\s+/gm, '') // Remove list items (unordered)
            .replace(/^\s*\d+\.\s+/gm, '') // Remove list items (ordered)
            .replace(/^\s*>\s+/gm, '') // Remove blockquotes
            .replace(/\n{2,}/g, '\n') // Normalize newlines
            .trim();
    } catch (e) {
        return markdown;
    }
};
