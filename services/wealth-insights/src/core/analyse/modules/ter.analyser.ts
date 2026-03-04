/**
 * TER (Total Expense Ratio) analyser.
 * Uses fund metadata from Kuvera (via mf.captnemo.in) for expense ratios.
 * Compares Direct vs Regular TER spread using comparison data.
 * Flags commission risk for Regular plan funds.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import {
    TERAnalysisResult,
    SchemeTER,
} from '@/types/analysis';
import { FundMetadata } from '@/types/analysis/enrichment.type';

export class TERAnalyser {
    /**
     * Analyse TER across portfolio schemes.
     * FundMetadata from Kuvera has:
     *   - expenseRatio: the fund's own TER
     *   - isDirect: whether this specific fund is Direct plan
     *   - comparison[]: peer funds which may include the Direct/Regular counterpart
     */
    static analyse(
        data: MFDetailedStatementData,
        metadataMap: Map<string, FundMetadata>,
    ): TERAnalysisResult {
        const schemes: SchemeTER[] = [];
        let potentialSavings = 0;
        let totalCommission = 0;

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const metadata = metadataMap.get(folio.scheme.isin);
            const plan = folio.scheme.plan; // "Direct" | "Regular" from CAMS
            const schemeMV = folio.snapshot.marketValue;

            let directTER: number | null = null;
            let regularTER: number | null = null;

            if (metadata?.expenseRatio !== null && metadata?.expenseRatio !== undefined) {
                // Use isDirect from Kuvera to determine which TER this is
                if (metadata.isDirect) {
                    directTER = metadata.expenseRatio;
                } else {
                    regularTER = metadata.expenseRatio;
                }

                // Try to find the counterpart TER from comparison data
                // The comparison array contains peer funds, some of which may be
                // the Direct/Regular counterpart of the same scheme
                if (metadata.comparison?.length) {
                    for (const peer of metadata.comparison) {
                        if (peer.expenseRatio === null) continue;
                        const peerName = peer.name.toLowerCase();
                        const isCounterpart = this.isSameSchemeCounterpart(
                            metadata.name,
                            peer.name,
                            metadata.isDirect,
                        );
                        if (isCounterpart) {
                            if (metadata.isDirect) {
                                regularTER = peer.expenseRatio;
                            } else {
                                directTER = peer.expenseRatio;
                            }
                            break;
                        }
                    }
                }
            }

            const terSpread = directTER !== null && regularTER !== null
                ? Math.round((regularTER - directTER) * 10000) / 10000
                : null;

            const activeTER = plan === 'Direct' ? directTER : regularTER;
            const annualCost = activeTER !== null ? schemeMV * (activeTER / 100) : 0;

            // Commission risk assessment
            let commissionRisk: SchemeTER['commissionRisk'] = 'Unknown';
            if (plan === 'Direct') {
                commissionRisk = 'Low';
            } else if (terSpread !== null) {
                if (terSpread > 1.0) commissionRisk = 'High';
                else if (terSpread > 0.5) commissionRisk = 'Medium';
                else commissionRisk = 'Low';
            } else if (regularTER !== null) {
                if (regularTER > 2.0) commissionRisk = 'High';
                else if (regularTER > 1.0) commissionRisk = 'Medium';
                else commissionRisk = 'Low';
            }

            if (plan === 'Regular' && terSpread !== null && terSpread > 0) {
                potentialSavings += schemeMV * (terSpread / 100);
                totalCommission += schemeMV * (terSpread / 100);
            }

            schemes.push({
                schemeName: folio.scheme.current_name,
                plan,
                regularTER,
                directTER,
                terSpread,
                commissionRisk,
                annualCostAmount: Math.round(annualCost * 100) / 100,
            });
        }

        return {
            schemes: schemes.sort((a, b) => b.annualCostAmount - a.annualCostAmount),
            potentialAnnualSavings: Math.round(potentialSavings * 100) / 100,
            totalCommissionPaidAnnually: Math.round(totalCommission * 100) / 100,
        };
    }

    /**
     * Check if a peer fund is the Direct/Regular counterpart of the current fund.
     * e.g. "Axis Small Cap Fund Direct Plan Growth" vs "Axis Small Cap Fund Regular Plan Growth"
     */
    private static isSameSchemeCounterpart(
        currentName: string,
        peerName: string,
        currentIsDirect: boolean,
    ): boolean {
        const normalize = (n: string) =>
            n.toLowerCase()
                .replace(/\s*(direct|regular)\s*(plan)?\s*/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();

        const currentNorm = normalize(currentName);
        const peerNorm = normalize(peerName);

        if (currentNorm !== peerNorm) return false;

        // They normalize the same, now verify the peer has the opposite plan
        const peerLower = peerName.toLowerCase();
        if (currentIsDirect) {
            return peerLower.includes('regular');
        } else {
            return peerLower.includes('direct');
        }
    }
}
