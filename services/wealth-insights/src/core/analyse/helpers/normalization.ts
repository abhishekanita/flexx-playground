/**
 * Text and data normalization utilities for mutual fund analysis.
 */

/**
 * Normalize text: lowercase, trim, collapse whitespace.
 */
export function normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize company name for deduplication across fund holdings.
 * Removes common suffixes like "Ltd", "Limited", "Pvt", "Private", etc.
 */
export function normalizeCompany(name: string): string {
    return normalizeText(name)
        .replace(/\b(limited|ltd|pvt|private|inc|incorporated|corp|corporation)\b/gi, '')
        .replace(/[.\-,()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Validate standard 12-character ISIN format.
 */
export function isValidISIN(text: string): boolean {
    return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(text);
}

/**
 * Get country hint from ISIN prefix.
 */
export function isinCountry(isin: string): 'India' | 'Global' | 'Unknown' {
    if (!isValidISIN(isin)) return 'Unknown';
    if (isin.startsWith('IN')) return 'India';
    return 'Global';
}

/**
 * Extract a clean scheme display name from the full CAMS scheme name.
 * Removes plan/option suffixes for cleaner display.
 */
export function cleanSchemeName(name: string): string {
    return name
        .replace(/\s*-?\s*(direct|regular)\s*(plan)?/i, '')
        .replace(/\s*-?\s*(growth|dividend|idcw)\s*(option|payout|reinvestment)?/i, '')
        .replace(/\s*\(non-demat\)/i, '')
        .replace(/\s*\(demat\)/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Parse a date string in "YYYY-MM-DD" format.
 * Returns null if invalid.
 */
export function parseDateSafe(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

/**
 * Format a number in Indian number format (lakhs, crores).
 */
export function formatINR(amount: number): string {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';

    if (abs >= 10000000) {
        return `${sign}${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
        return `${sign}${(abs / 100000).toFixed(2)} L`;
    }
    return `${sign}${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
