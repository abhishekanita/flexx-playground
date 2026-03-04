import { parserConfigLoader } from '@/services/parse/parser-config-loader';

export class MerchantResolverService {
    /**
     * Resolve a raw merchant name to a normalized display name.
     * Tries exact alias match first, then fuzzy matching.
     */
    resolve(rawName: string): string {
        if (!rawName) return 'Unknown';

        // Try exact alias lookup
        const aliased = parserConfigLoader.resolveMerchant(rawName);
        if (aliased !== rawName) return aliased;

        // Try cleaning the name
        const cleaned = this.cleanMerchantName(rawName);
        const aliasedCleaned = parserConfigLoader.resolveMerchant(cleaned);
        if (aliasedCleaned !== cleaned) return aliasedCleaned;

        // Return cleaned version as-is
        return this.titleCase(cleaned);
    }

    /**
     * Compute similarity between two merchant names (0-1).
     * Ported from experiment-reconciliation.ts merchantSimilarity().
     */
    similarity(a: string, b: string): number {
        if (!a || !b) return 0;

        const na = this.normalize(a);
        const nb = this.normalize(b);

        if (na === nb) return 1.0;
        if (na.includes(nb) || nb.includes(na)) return 0.8;

        // Word overlap
        const wordsA = new Set(na.split(/\s+/));
        const wordsB = new Set(nb.split(/\s+/));
        const intersection = [...wordsA].filter((w) => wordsB.has(w));

        if (intersection.length > 0) {
            return 0.5 * (intersection.length / Math.max(wordsA.size, wordsB.size));
        }

        return 0;
    }

    private cleanMerchantName(name: string): string {
        return name
            .replace(/PVT\.?\s*LTD\.?/gi, '')
            .replace(/PRIVATE\s*LIMITED/gi, '')
            .replace(/LIMITED/gi, '')
            .replace(/INDIA/gi, '')
            .replace(/TECHNOLOGIES/gi, '')
            .replace(/SYSTEMS?/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private normalize(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    private titleCase(name: string): string {
        return name
            .toLowerCase()
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
}

export const merchantResolverService = new MerchantResolverService();
