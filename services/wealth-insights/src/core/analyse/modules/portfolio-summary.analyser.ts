import { MFDetailedStatementData } from '../../../types/statements/mf-statements.type';
import {
    PortfolioSummaryResult,
    FundHouseSummary,
} from '../../../types/analysis';
import { getTotalInvested, getTotalWithdrawn } from '../helpers/cashflow-builder';

export class PortfolioSummaryAnalyser {
    static analyse(data: MFDetailedStatementData): PortfolioSummaryResult {
        const totalCostValue = data.totalCostValue;
        const totalMarketValue = data.totalMarketValue;
        const totalUnrealisedGain = totalMarketValue - totalCostValue;
        const totalUnrealisedGainPct =
            totalCostValue > 0 ? (totalUnrealisedGain / totalCostValue) * 100 : 0;

        // Fund house summary from portfolioSummary
        const fundHouseSummary: FundHouseSummary[] = data.portfolioSummary.map((ps) => {
            const gain = ps.marketValue - ps.costValue;
            return {
                fundHouse: ps.fundHouse,
                costValue: ps.costValue,
                marketValue: ps.marketValue,
                gain,
                gainPct: ps.costValue > 0 ? (gain / ps.costValue) * 100 : 0,
                weight: totalMarketValue > 0 ? (ps.marketValue / totalMarketValue) * 100 : 0,
            };
        });

        // Compute total invested/withdrawn from all transactions
        let totalInvested = 0;
        let totalWithdrawn = 0;
        let activeFolioCount = 0;
        let closedFolioCount = 0;

        for (const folio of data.folios) {
            totalInvested += getTotalInvested(folio);
            totalWithdrawn += getTotalWithdrawn(folio);

            if (folio.closingUnitBalance > 0) {
                activeFolioCount++;
            } else {
                closedFolioCount++;
            }
        }

        const lifetimePnL = totalWithdrawn + totalMarketValue - totalInvested;
        const lifetimeReturnPct = totalInvested > 0 ? (lifetimePnL / totalInvested) * 100 : 0;

        return {
            totalCostValue,
            totalMarketValue,
            totalUnrealisedGain,
            totalUnrealisedGainPct,
            totalInvested,
            totalWithdrawn,
            lifetimePnL,
            lifetimeReturnPct,
            fundHouseSummary,
            activeFolioCount,
            closedFolioCount,
        };
    }
}
