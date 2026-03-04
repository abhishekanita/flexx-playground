import { JourneyCard, LiveBindingFormat } from '@/types/advisory/card-journey.type';
import { PortfolioAnalysis } from '@/types/analysis';

/**
 * Replace {{placeholder}} tokens in card bodies with values from snapshotValues or live analysis data.
 */
export function resolveLiveBindings(cards: JourneyCard[], snapshotValues: Record<string, any>, analysis?: PortfolioAnalysis): JourneyCard[] {
    return cards.map(card => {
        let body = card.body;
        let highlightValue = card.highlightValue;

        // Replace {{placeholder}} tokens from snapshot values
        body = replaceTokens(body, snapshotValues);
        if (highlightValue) {
            highlightValue = replaceTokens(highlightValue, snapshotValues);
        }

        // Resolve live bindings from analysis if present
        if (card.liveBindings && analysis) {
            for (const [token, binding] of Object.entries(card.liveBindings)) {
                const raw = getNestedValue(analysis, binding.path);
                const formatted = formatValue(raw, binding.format, binding.fallback);
                body = body.split(`{{${token}}}`).join(formatted);
                if (highlightValue) {
                    highlightValue = highlightValue.split(`{{${token}}}`).join(formatted);
                }
            }
        }

        return { ...card, body, highlightValue };
    });
}

function replaceTokens(text: string, values: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const val = values[key];
        if (val === undefined || val === null) return match;
        if (typeof val === 'number') {
            // Format number without ₹ — templates control currency symbol
            return formatNumberIndian(val);
        }
        return String(val);
    });
}

function formatNumberIndian(amount: number): string {
    if (isNaN(amount)) return '0';
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}${abs.toLocaleString('en-IN')}`;
    // For small numbers, just format with appropriate decimal places
    if (abs === 0) return '0';
    if (abs < 0.01) return `${sign}${abs.toFixed(4)}`;
    if (abs < 1) return `${sign}${abs.toFixed(2)}`;
    return `${sign}${abs.toLocaleString('en-IN')}`;
}

/**
 * Dot-path resolver supporting array[0] notation.
 * e.g. "activeHoldings[0].schemeName"
 */
export function getNestedValue(obj: any, dotPath: string): any {
    const parts = dotPath.split('.');
    let current = obj;

    for (const part of parts) {
        if (current === null || current === undefined) return undefined;

        // Handle array notation: "items[0]"
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
            current = current[arrayMatch[1]];
            if (Array.isArray(current)) {
                current = current[parseInt(arrayMatch[2])];
            } else {
                return undefined;
            }
        } else {
            current = current[part];
        }
    }

    return current;
}

export function formatValue(raw: any, format: LiveBindingFormat, fallback: string): string {
    if (raw === null || raw === undefined) return fallback;

    switch (format) {
        case 'currency':
            return formatCurrency(typeof raw === 'number' ? raw : parseFloat(raw));
        case 'percent':
            return `${(typeof raw === 'number' ? raw : parseFloat(raw)).toFixed(1)}%`;
        case 'number':
            return (typeof raw === 'number' ? raw : parseFloat(raw)).toLocaleString('en-IN');
        case 'date':
            return new Date(raw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        case 'text':
        default:
            return String(raw);
    }
}

function formatCurrency(amount: number): string {
    if (isNaN(amount)) return '₹0';
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
    return `${sign}₹${abs.toFixed(0)}`;
}
