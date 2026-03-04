/**
 * AMFI Master data provider.
 * Fetches the complete AMFI NAV file (NAVAll.txt).
 *
 * Actual format (verified):
 *   - Semicolon-delimited (;)
 *   - Header: "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date"
 *   - Missing ISINs shown as "-" (single hyphen)
 *   - Date format: "DD-MMM-YYYY" (e.g. "27-Feb-2026")
 *   - Section headers: "Open Ended Schemes(Debt Scheme - Banking and PSU Fund)"
 *     where category is in parentheses
 *   - Fund house lines: plain text like "Axis Mutual Fund"
 *   - Blank lines separate sections
 *   - URL redirects to portal.amfiindia.com
 *
 * Cache strategy (two-level):
 *   1. In-memory arrays + indices (per-process, instant)
 *   2. MongoDB mfs.enriched.cache stores raw text blob (persistent, 24h TTL)
 *   3. AMFI HTTP fetch (cold fetch)
 */

import axios from 'axios';
import { AMFIScheme } from '@/types/analysis/enrichment.type';
import { enrichmentCache } from '@/services/enrichment-cache.service';

const AMFI_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';
const AMFI_CACHE_KEY = '__raw_text__';

export class AMFIMasterProvider {
    private schemes: AMFIScheme[] = [];
    private isinIndex = new Map<string, AMFIScheme>();
    private codeIndex = new Map<number, AMFIScheme>();
    private loaded = false;

    /**
     * Load and parse the AMFI master file. Cached after first call.
     * Checks MongoDB for cached raw text before hitting AMFI HTTP endpoint.
     */
    async load(): Promise<void> {
        if (this.loaded) return;

        // Level 2: Check MongoDB for cached raw text
        const cachedText = await enrichmentCache.get<string>('amfi_master', AMFI_CACHE_KEY);
        if (cachedText) {
            this.parseAMFIText(cachedText);
            this.loaded = true;
            console.log(`[AMFIMaster] Loaded ${this.schemes.length} schemes (from cache)`);
            return;
        }

        // Level 3: Fetch fresh from AMFI
        try {
            const { data } = await axios.get<string>(AMFI_URL, {
                timeout: 30000,
                responseType: 'text',
                maxRedirects: 5, // follows redirect to portal.amfiindia.com
            });

            this.parseAMFIText(data);
            this.loaded = true;
            console.log(`[AMFIMaster] Loaded ${this.schemes.length} schemes (fresh fetch)`);

            // Store raw text in MongoDB for next time
            await enrichmentCache.set('amfi_master', AMFI_CACHE_KEY, data);
        } catch (err) {
            console.warn('[AMFIMaster] Failed to load:', (err as Error).message);
        }
    }

    /**
     * Look up a scheme by ISIN (growth or div-reinvest).
     */
    findByISIN(isin: string): AMFIScheme | undefined {
        return this.isinIndex.get(isin);
    }

    /**
     * Look up a scheme by AMFI scheme code.
     */
    findByCode(code: number): AMFIScheme | undefined {
        return this.codeIndex.get(code);
    }

    /**
     * Find scheme code for a given ISIN. Returns undefined if not found.
     */
    getSchemeCode(isin: string): number | undefined {
        return this.isinIndex.get(isin)?.schemeCode;
    }

    /**
     * Get all schemes in a given category.
     */
    getByCategory(category: string): AMFIScheme[] {
        const lower = category.toLowerCase();
        return this.schemes.filter((s) => s.schemeCategory.toLowerCase().includes(lower));
    }

    get isLoaded(): boolean {
        return this.loaded;
    }

    get schemeCount(): number {
        return this.schemes.length;
    }

    /**
     * Find the Direct/Regular counterpart of a scheme.
     * If ISIN is a Regular plan, returns the Direct counterpart (and vice versa).
     */
    findCounterpart(isin: string): AMFIScheme | undefined {
        const scheme = this.findByISIN(isin);
        if (!scheme) return undefined;

        const name = scheme.schemeName.toLowerCase();
        const isDirect = name.includes('direct');

        // Normalize: strip plan identifiers, "option", trailing hyphens, and collapse whitespace
        const normalize = (n: string) =>
            n.toLowerCase()
                .replace(/\s*-?\s*(direct|regular)\s*(plan)?\s*-?\s*/gi, ' ')
                .replace(/\s*-?\s*growth\s*(option)?\s*-?\s*/gi, ' growth ')
                .replace(/\s*-\s*/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

        const normalizedName = normalize(scheme.schemeName);

        for (const s of this.schemes) {
            if (s.schemeCode === scheme.schemeCode) continue;
            if (normalize(s.schemeName) !== normalizedName) continue;

            const sName = s.schemeName.toLowerCase();
            if (isDirect && sName.includes('regular')) return s;
            if (!isDirect && sName.includes('direct')) return s;
        }
        return undefined;
    }

    /**
     * Check if a scheme name indicates Direct plan.
     */
    static isDirect(schemeName: string): boolean {
        return schemeName.toLowerCase().includes('direct');
    }

    /**
     * Fuzzy search for a scheme by name when ISIN lookup fails.
     * Uses word overlap scoring — returns best match above 60% threshold.
     */
    fuzzyFindByName(schemeName: string, plan?: 'Direct' | 'Regular'): AMFIScheme | undefined {
        const targetWords = this.extractKeywords(schemeName);
        if (targetWords.length === 0) return undefined;

        let bestMatch: AMFIScheme | undefined;
        let bestScore = 0;

        for (const scheme of this.schemes) {
            // Filter by plan if specified
            if (plan) {
                const sLower = scheme.schemeName.toLowerCase();
                if (plan === 'Direct' && !sLower.includes('direct')) continue;
                if (plan === 'Regular' && (sLower.includes('direct') || !sLower.includes('regular'))) continue;
            }

            // Only match Growth options (skip IDCW/Dividend)
            const sLower = scheme.schemeName.toLowerCase();
            if (sLower.includes('idcw') || sLower.includes('dividend')) continue;

            const schemeWords = this.extractKeywords(scheme.schemeName);
            if (schemeWords.length === 0) continue;

            // Compute word overlap score
            const intersection = targetWords.filter((w) => schemeWords.includes(w));
            const score = (2 * intersection.length) / (targetWords.length + schemeWords.length);

            // Require at least 3 keyword overlap and 70% score to avoid false positives
            if (score > bestScore && score >= 0.7 && intersection.length >= 3) {
                bestScore = score;
                bestMatch = scheme;
            }
        }

        return bestMatch;
    }

    private extractKeywords(name: string): string[] {
        const STOP_WORDS = [
            'fund', 'plan', 'growth', 'option', 'options', 'scheme',
            'the', 'of', 'and', 'in', 'for',
            'direct', 'regular', 'idcw', 'dividend', 'payout', 'reinvestment',
            'open', 'ended', 'close',
        ];
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 1)
            .filter((w) => !STOP_WORDS.includes(w));
    }

    private parseAMFIText(text: string): void {
        const lines = text.split('\n');
        let currentSchemeType = '';
        let currentCategory = '';
        let currentFundHouse = '';
        let isHeader = true;

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip blank lines
            if (!trimmed) continue;

            // Skip the header row
            if (isHeader && trimmed.startsWith('Scheme Code;')) {
                isHeader = false;
                continue;
            }
            isHeader = false;

            // Check if this is a section header with category in parentheses
            // e.g. "Open Ended Schemes(Debt Scheme - Banking and PSU Fund)"
            const sectionMatch = trimmed.match(/^(Open Ended|Close Ended|Interval)\s*(Schemes?)?\s*\((.+)\)\s*$/i);
            if (sectionMatch) {
                currentSchemeType = sectionMatch[1].trim() + ' Schemes';
                currentCategory = sectionMatch[3].trim();
                continue;
            }

            // Check for section header without parentheses
            if (/^(Open Ended|Close Ended|Interval)/i.test(trimmed) && !trimmed.includes(';')) {
                currentSchemeType = trimmed;
                continue;
            }

            // Data row: has semicolons (6 fields)
            if (trimmed.includes(';')) {
                const parts = trimmed.split(';');
                if (parts.length < 5) continue;

                const schemeCode = parseInt(parts[0], 10);
                if (isNaN(schemeCode)) continue;

                // Col 2: ISIN Div Payout / Growth - "-" means absent
                const isinGrowth = parts[1]?.trim() || '';
                const isinDivReinvest = parts[2]?.trim() || '';

                const scheme: AMFIScheme = {
                    schemeCode,
                    isinDivPayoutOrGrowth: isinGrowth === '-' ? '' : isinGrowth,
                    isinDivReinvestment: isinDivReinvest === '-' ? '' : isinDivReinvest,
                    schemeName: parts[3]?.trim() || '',
                    nav: parseFloat(parts[4]) || 0,
                    navDate: parts[5]?.trim() || '', // "DD-MMM-YYYY" e.g. "27-Feb-2026"
                    schemeType: currentSchemeType,
                    schemeCategory: currentCategory,
                    fundHouse: currentFundHouse,
                };

                this.schemes.push(scheme);

                // Index by both ISINs
                if (scheme.isinDivPayoutOrGrowth) {
                    this.isinIndex.set(scheme.isinDivPayoutOrGrowth, scheme);
                }
                if (scheme.isinDivReinvestment) {
                    this.isinIndex.set(scheme.isinDivReinvestment, scheme);
                }
                this.codeIndex.set(scheme.schemeCode, scheme);
                continue;
            }

            // Non-data, non-section line → likely a fund house name
            // Fund house names appear as standalone text lines between blank lines
            currentFundHouse = trimmed;
        }
    }
}
