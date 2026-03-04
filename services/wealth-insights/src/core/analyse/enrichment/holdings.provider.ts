/**
 * Fund holdings provider.
 * Parses AMC portfolio disclosure Excel files.
 *
 * Since direct download URLs are not stable (see holdings-config.ts),
 * this provider works with locally downloaded Excel files.
 * For production, files should be downloaded periodically (monthly)
 * via a headless browser scraper or manual process.
 *
 * Cache strategy (two-level):
 *   1. In-memory Map (per-process, instant)
 *   2. MongoDB mfs.enriched.cache (persistent, 30-day TTL)
 *   3. Local Excel file parsing (cold parse)
 *
 * When holdingsDir is provided → parse Excel, cache results in MongoDB.
 * When holdingsDir is NOT provided → load from MongoDB cache (previous runs).
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { FundHolding, FundHoldingsSource } from '@/types/analysis/enrichment.type';
import { normalizeText, isValidISIN } from '../helpers/normalization';
import { enrichmentCache } from '@/services/enrichment-cache.service';

export class HoldingsProvider {
    private cache = new Map<string, FundHoldingsSource>();

    /**
     * Load holdings from a local Excel file.
     */
    loadFromFile(filePath: string, amc: string): FundHoldingsSource[] {
        try {
            const buffer = fs.readFileSync(filePath);
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            return this.parseWorkbook(workbook, amc);
        } catch (err) {
            console.warn(`[HoldingsProvider] Failed to load ${filePath}:`, (err as Error).message);
            return [];
        }
    }

    /**
     * Load holdings from multiple local files.
     * Also caches parsed results in MongoDB for subsequent runs without the directory.
     */
    async loadFromDirectory(dirPath: string): Promise<Map<string, FundHoldingsSource>> {
        const results = new Map<string, FundHoldingsSource>();
        const toCache: { key: string; data: any }[] = [];

        try {
            const files = fs.readdirSync(dirPath).filter(
                (f) => f.endsWith('.xlsx') || f.endsWith('.xls'),
            );

            for (const file of files) {
                const amc = file.replace(/\.(xlsx|xls)$/, '').replace(/[-_]/g, ' ');
                const sources = this.loadFromFile(`${dirPath}/${file}`, amc);
                for (const s of sources) {
                    this.cache.set(s.sourceKey, s);
                    results.set(s.sourceKey, s);
                    toCache.push({ key: s.sourceKey, data: s });
                }
            }

            // Store parsed results in MongoDB for runs without holdingsDir
            if (toCache.length > 0) {
                await enrichmentCache.setMany('holdings', toCache);
                console.log(`[HoldingsProvider] Cached ${toCache.length} holdings sources in MongoDB`);
            }
        } catch (err) {
            console.warn(`[HoldingsProvider] Failed to read directory ${dirPath}:`, (err as Error).message);
        }

        return results;
    }

    /**
     * Load all previously cached holdings from MongoDB.
     * Used when no holdingsDir is provided but holdings were cached in a previous run.
     */
    async loadFromCache(): Promise<Map<string, FundHoldingsSource>> {
        const cached = await enrichmentCache.getAll<FundHoldingsSource>('holdings');

        // Populate in-memory cache
        for (const [key, source] of cached) {
            this.cache.set(key, source);
        }

        if (cached.size > 0) {
            console.log(`[HoldingsProvider] Loaded ${cached.size} holdings sources from MongoDB cache`);
        }

        return cached;
    }

    /**
     * Find holdings for a scheme by matching its ISIN or name.
     */
    findHoldingsForScheme(
        schemeISIN: string,
        schemeName: string,
        holdingsMap: Map<string, FundHoldingsSource>,
    ): FundHoldingsSource | null {
        // 1. Try exact ISIN match in holdings data
        for (const [, source] of holdingsMap) {
            for (const h of source.holdings) {
                if (h.isin === schemeISIN) return source;
            }
        }

        // 2. Try name matching
        const normalized = normalizeText(schemeName);
        let bestMatch: FundHoldingsSource | null = null;
        let bestScore = 0;

        for (const [, source] of holdingsMap) {
            const sourceNorm = normalizeText(source.schemeName);
            const words1 = normalized.split(' ').filter((w) => w.length > 2);
            const words2 = sourceNorm.split(' ').filter((w) => w.length > 2);
            const common = words1.filter((w) => words2.includes(w)).length;
            const score = common / Math.max(words1.length, words2.length);

            if (score > bestScore && score > 0.5) {
                bestScore = score;
                bestMatch = source;
            }
        }

        return bestMatch;
    }

    /**
     * Build an ISIN → FundHoldingsSource lookup for active portfolio folios.
     */
    buildSchemeHoldingsLookup(
        schemeISINs: { isin: string; schemeName: string }[],
        holdingsMap: Map<string, FundHoldingsSource>,
    ): Map<string, FundHoldingsSource> {
        const lookup = new Map<string, FundHoldingsSource>();

        for (const { isin, schemeName } of schemeISINs) {
            const match = this.findHoldingsForScheme(isin, schemeName, holdingsMap);
            if (match) lookup.set(isin, match);
        }

        return lookup;
    }

    private parseWorkbook(workbook: XLSX.WorkBook, amc: string): FundHoldingsSource[] {
        const results: FundHoldingsSource[] = [];

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (rows.length < 3) continue;

            // Find header row
            const headerIdx = rows.findIndex((row) =>
                row.some(
                    (cell) =>
                        typeof cell === 'string' &&
                        (cell.toLowerCase().includes('instrument') ||
                            cell.toLowerCase().includes('isin') ||
                            cell.toLowerCase().includes('industry')),
                ),
            );
            if (headerIdx < 0) continue;

            const headers = (rows[headerIdx] as string[]).map((h) =>
                typeof h === 'string' ? h.toLowerCase().trim() : '',
            );

            const colIdx = {
                instrument: headers.findIndex((h) => h.includes('instrument') || h.includes('company') || h.includes('name')),
                isin: headers.findIndex((h) => h.includes('isin')),
                industry: headers.findIndex((h) => h.includes('industry') || h.includes('sector')),
                pctNav: headers.findIndex((h) => h.includes('% of') || h.includes('nav') || h.includes('percentage')),
                marketValue: headers.findIndex((h) => h.includes('market') && h.includes('value')),
            };

            if (colIdx.instrument < 0) continue;

            const holdings: FundHolding[] = [];
            let currentSection: 'equity' | 'debt' | 'others' = 'equity';
            let equityTotal = 0;
            let debtTotal = 0;
            let othersTotal = 0;

            for (let i = headerIdx + 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || !row[colIdx.instrument]) continue;

                const instrument = String(row[colIdx.instrument]).trim();
                if (!instrument) continue;

                const lowerInst = instrument.toLowerCase();
                if (lowerInst.includes('debt') || lowerInst.includes('fixed income')) {
                    currentSection = 'debt';
                    continue;
                }
                if (lowerInst.includes('other') || lowerInst.includes('net current')) {
                    currentSection = 'others';
                    continue;
                }
                if (lowerInst.includes('total') || lowerInst.includes('grand')) {
                    const pct = colIdx.pctNav >= 0 ? parseFloat(String(row[colIdx.pctNav])) || 0 : 0;
                    if (currentSection === 'equity') equityTotal = pct;
                    else if (currentSection === 'debt') debtTotal = pct;
                    else othersTotal = pct;
                    continue;
                }

                const isin = colIdx.isin >= 0 ? String(row[colIdx.isin] || '').trim() : '';
                const industry = colIdx.industry >= 0 ? String(row[colIdx.industry] || '').trim() : '';
                const pctOfNAV = colIdx.pctNav >= 0 ? parseFloat(String(row[colIdx.pctNav])) || 0 : 0;
                const mvLakhs = colIdx.marketValue >= 0 ? parseFloat(String(row[colIdx.marketValue])) || null : null;

                if (pctOfNAV <= 0 && !isValidISIN(isin)) continue;

                holdings.push({
                    sourceKey: `${amc}|${sheetName}`,
                    section: currentSection,
                    instrument,
                    isin,
                    industry,
                    pctOfNAV,
                    marketValueLakhs: mvLakhs,
                });
            }

            if (holdings.length > 0) {
                results.push({
                    sourceKey: `${amc}|${sheetName}`,
                    amc,
                    schemeName: sheetName,
                    schemeKeywords: this.extractKeywords(sheetName),
                    holdings,
                    assetTotals: {
                        equity: equityTotal || holdings.filter((h) => h.section === 'equity').reduce((s, h) => s + h.pctOfNAV, 0),
                        debt: debtTotal || holdings.filter((h) => h.section === 'debt').reduce((s, h) => s + h.pctOfNAV, 0),
                        others: othersTotal || holdings.filter((h) => h.section === 'others').reduce((s, h) => s + h.pctOfNAV, 0),
                    },
                    fetchedAt: new Date(),
                });
            }
        }

        return results;
    }

    private extractKeywords(sheetName: string): string[] {
        return sheetName
            .replace(/direct|regular|growth|dividend|idcw|plan|option|-/gi, '')
            .split(/\s+/)
            .filter((w) => w.length > 2);
    }
}
