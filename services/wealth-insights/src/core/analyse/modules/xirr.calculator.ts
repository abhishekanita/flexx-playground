import { MFDetailedStatementData } from '../../../types/statements/mf-statements.type';
import { XIRRAnalysisResult, SchemeXIRR } from '../../../types/analysis';
import { xirr, Cashflow, parseDate, daysBetween } from '../helpers/financial-math';
import {
    buildPortfolioCashflows,
    buildPortfolioCashflowsExCharges,
    buildFolioCashflows,
    getNetInvested,
} from '../helpers/cashflow-builder';

export class XIRRCalculator {
    static analyse(data: MFDetailedStatementData, asOfDate?: string): XIRRAnalysisResult {
        const asOf = asOfDate
            ? parseDate(asOfDate)
            : this.determineAsOfDate(data);

        // Portfolio-level XIRR (including stamp duty)
        const portfolioCashflows = buildPortfolioCashflows(data);
        const portfolioTerminalCF: Cashflow = [asOf, data.totalMarketValue];
        const portfolioXIRR = this.computeXIRR([...portfolioCashflows, portfolioTerminalCF]);

        // Portfolio-level XIRR (excluding stamp duty)
        const portfolioCashflowsExCharges = buildPortfolioCashflowsExCharges(data);
        const portfolioXIRRExCharges = this.computeXIRR([
            ...portfolioCashflowsExCharges,
            portfolioTerminalCF,
        ]);

        // Scheme-level XIRR
        const schemeXIRR: SchemeXIRR[] = [];
        for (const folio of data.folios) {
            const folioCashflows = buildFolioCashflows(folio);
            if (folioCashflows.length === 0) continue;

            const terminalMV = folio.snapshot.marketValue;
            const terminalCF: Cashflow = [asOf, terminalMV];
            const allCF = [...folioCashflows, terminalCF];

            const schemeIRR = this.computeXIRR(allCF);
            const firstTxDate = folio.transactions[0]?.date || '';
            const holdDays = firstTxDate
                ? daysBetween(parseDate(firstTxDate), asOf)
                : 0;
            const netInvested = getNetInvested(folio);

            schemeXIRR.push({
                fundHouse: folio.fundHouse,
                schemeName: folio.scheme.current_name,
                folioNumber: folio.folioNumber,
                isin: folio.scheme.isin,
                marketValue: terminalMV,
                xirr: schemeIRR,
                firstTxDate: firstTxDate,
                holdingDays: holdDays,
                netInvested,
                reliability: this.classifyReliability(holdDays, netInvested),
            });
        }

        return {
            portfolioXIRR,
            portfolioXIRRExCharges,
            schemeXIRR,
        };
    }

    private static computeXIRR(cashflows: Cashflow[]): number {
        const rate = xirr(cashflows);
        if (isNaN(rate)) return NaN;
        return Math.round(rate * 10000) / 100; // convert to %, 2 decimal places
    }

    private static determineAsOfDate(data: MFDetailedStatementData): Date {
        // Use the latest NAV date across all active folios
        let latest = '';
        for (const folio of data.folios) {
            if (folio.closingUnitBalance > 0 && folio.snapshot.navDate > latest) {
                latest = folio.snapshot.navDate;
            }
        }
        return latest ? parseDate(latest) : new Date();
    }

    private static classifyReliability(
        holdingDays: number,
        netInvested: number,
    ): SchemeXIRR['reliability'] {
        const absInvested = Math.abs(netInvested);
        if (holdingDays < 30 || absInvested < 500) return 'Insufficient';
        if (holdingDays < 90 || absInvested < 1000) return 'Low Sample';
        if (holdingDays < 180 || absInvested < 10000) return 'Medium Sample';
        return 'High';
    }
}
