/**
 * Groww data provider.
 *
 * Queries mfs.market.schemes (populated by Groww scraper) to enrich analysis.
 * The Groww scraper has already fetched scheme-level data for thousands of MF schemes,
 * including holdings, risk stats, expense ratios, category rankings, etc.
 *
 * This provider is the primary source for:
 *   - Fund holdings (replaces manual Excel downloads from AMC websites)
 *   - Scheme-level metadata (supplements Kuvera/AMFI data)
 *
 * Lookup: user's folio ISIN → mfs.market.schemes.isin → rich scheme data
 */

import { GrowwSchemeModel } from '@/schema/market/groww-scheme.schema';
import { GrowwScheme, GrowwHolding } from '@/types/market';
import { FundHolding, FundHoldingsSource } from '@/types/analysis/enrichment.type';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('GrowwData');

export interface GrowwEnrichmentResult {
    /** Holdings in FundHoldingsSource format — plugs directly into existing analysis modules */
    holdingsLookup: Map<string, FundHoldingsSource>;
    /** Raw Groww scheme data keyed by ISIN — for additional enrichment (riskStats, categoryRank, etc.) */
    schemes: Map<string, GrowwScheme>;
}

export class GrowwDataProvider {
    /**
     * Look up Groww data for a list of ISINs.
     * Returns both converted holdings and raw scheme data.
     */
    async fetchByISINs(isins: string[]): Promise<GrowwEnrichmentResult> {
        const holdingsLookup = new Map<string, FundHoldingsSource>();
        const schemes = new Map<string, GrowwScheme>();

        if (isins.length === 0) {
            return { holdingsLookup, schemes };
        }

        const unique = [...new Set(isins)];

        try {
            const docs = await GrowwSchemeModel.find({ isin: { $in: unique } }).lean();

            for (const doc of docs) {
                if (!doc.isin) continue;

                // Store raw scheme data
                schemes.set(doc.isin, doc as unknown as GrowwScheme);

                // Convert holdings if available (from deep sync)
                if (doc.holdings && Array.isArray(doc.holdings) && doc.holdings.length > 0) {
                    const source = this.convertToHoldingsSource(
                        doc.isin,
                        doc.schemeName,
                        doc.searchId,
                        doc.fundHouse,
                        doc.holdings as GrowwHolding[],
                    );
                    if (source) {
                        holdingsLookup.set(doc.isin, source);
                    }
                }
            }

            const withHoldings = holdingsLookup.size;
            const total = schemes.size;
            const missed = unique.length - total;

            log.info(
                `Matched ${total}/${unique.length} ISINs from Groww` +
                (withHoldings > 0 ? `, ${withHoldings} with holdings` : '') +
                (missed > 0 ? `, ${missed} not in Groww DB` : ''),
            );
        } catch (err) {
            log.warn(`Failed to query Groww schemes: ${(err as Error).message}`);
        }

        return { holdingsLookup, schemes };
    }

    /**
     * Convert Groww holdings array → FundHoldingsSource format.
     * This makes Groww data compatible with SectorAnalyser, CompanyExposureAnalyser,
     * AssetAllocationAnalyser, and other modules that consume FundHoldingsSource.
     */
    private convertToHoldingsSource(
        isin: string,
        schemeName: string,
        searchId: string,
        fundHouse: string,
        holdings: GrowwHolding[],
    ): FundHoldingsSource | null {
        const converted: FundHolding[] = [];
        let equityTotal = 0;
        let debtTotal = 0;
        let othersTotal = 0;
        const sourceKey = `groww|${searchId}`;

        for (const h of holdings) {
            if (!h.company && !h.instrument) continue;

            const corpusPer = h.corpusPer ?? 0;

            // Skip negligible holdings
            if (Math.abs(corpusPer) < 0.01) continue;

            const section = this.classifySection(h);

            // Accumulate asset totals (only positive weights count toward totals)
            if (corpusPer > 0) {
                if (section === 'equity') equityTotal += corpusPer;
                else if (section === 'debt') debtTotal += corpusPer;
                else othersTotal += corpusPer;
            }

            converted.push({
                sourceKey,
                section,
                instrument: h.company || h.instrument || '',
                isin: '',  // Groww doesn't provide per-holding ISINs
                industry: h.sector || '',
                pctOfNAV: corpusPer,
                marketValueLakhs: h.marketValue != null ? h.marketValue * 100 : null, // Groww stores in crores → convert to lakhs
            });
        }

        if (converted.length === 0) return null;

        return {
            sourceKey,
            amc: fundHouse,
            schemeName,
            schemeKeywords: schemeName
                .replace(/direct|regular|growth|dividend|idcw|plan|option|-/gi, '')
                .split(/\s+/)
                .filter((w) => w.length > 2),
            holdings: converted,
            assetTotals: {
                equity: equityTotal,
                debt: debtTotal,
                others: othersTotal,
            },
            fetchedAt: new Date(),
        };
    }

    /**
     * Classify a Groww holding into equity/debt/others.
     *
     * Groww holdings have: company, sector, instrument (type), rating, corpusPer, marketValue.
     * - If `rating` is present → typically a debt instrument (NCDs, bonds have credit ratings)
     * - If `instrument` indicates debt → debt
     * - If company name suggests government securities → debt
     * - Otherwise → equity
     */
    private classifySection(h: GrowwHolding): 'equity' | 'debt' | 'others' {
        const instrument = (h.instrument || '').toLowerCase();
        const company = (h.company || '').toLowerCase();

        // Rated instruments are typically debt (NCDs, bonds, CPs, etc.)
        if (h.rating) return 'debt';

        // Instrument type hints
        if (
            instrument.includes('ncd') ||
            instrument.includes('bond') ||
            instrument.includes('debenture') ||
            instrument.includes('debt') ||
            instrument.includes('commercial paper') ||
            instrument.includes('certificate of deposit') ||
            instrument.includes('cp') ||
            instrument.includes('cd') ||
            instrument.includes('t-bill') ||
            instrument.includes('treasury') ||
            instrument.includes('government') ||
            instrument.includes('gsec') ||
            instrument.includes('sdl') ||
            instrument.includes('fixed deposit') ||
            instrument.includes('repo') ||
            instrument.includes('treps') ||
            instrument.includes('cblo')
        ) {
            return 'debt';
        }

        // Company name hints for debt
        if (
            company.includes('treasury bill') ||
            company.includes('government of india') ||
            company.includes('state development loan') ||
            company.includes('gsec') ||
            company.includes('t-bill') ||
            company.includes('sovereign gold') ||
            company.includes('reverse repo') ||
            company.includes('treps') ||
            company.includes('cblo') ||
            company.includes('net receivable') ||
            company.includes('net current')
        ) {
            return 'debt';
        }

        // Cash and other assets
        if (
            company.includes('cash') ||
            company.includes('net current asset') ||
            company.includes('net receivable')
        ) {
            return 'others';
        }

        return 'equity';
    }
}
