import { MFDetailedStatementData } from '../../../types/statements/mf-statements.type';
import {
    TransactionTimelineResult,
    DailyTimeline,
    FundTimeline,
    AnnualCashflow,
} from '../../../types/analysis';

const INVESTMENT_TYPES = new Set([
    'Purchase', 'SIP', 'Switch In', 'STP In', 'NFO Allotment',
]);

const WITHDRAWAL_TYPES = new Set([
    'Redemption', 'SIP Redemption', 'SWP', 'Switch Out', 'STP Out', 'Dividend Payout',
]);

export class TransactionTimelineAnalyser {
    static analyse(data: MFDetailedStatementData): TransactionTimelineResult {
        const dailyMap = new Map<string, { invested: number; withdrawn: number }>();
        const fundEntries: FundTimeline[] = [];
        const annualMap = new Map<number, { invested: number; withdrawn: number }>();

        for (const folio of data.folios) {
            for (const tx of folio.transactions) {
                const amount = tx.amount;
                if (amount === null || amount === 0) continue;

                const absAmount = Math.abs(amount);
                const date = tx.date;
                const year = parseInt(date.substring(0, 4), 10);
                const isInvestment = INVESTMENT_TYPES.has(tx.type);
                const isWithdrawal = WITHDRAWAL_TYPES.has(tx.type);

                if (!isInvestment && !isWithdrawal) continue;

                // Daily timeline
                if (!dailyMap.has(date)) {
                    dailyMap.set(date, { invested: 0, withdrawn: 0 });
                }
                const daily = dailyMap.get(date)!;
                if (isInvestment) daily.invested += absAmount;
                if (isWithdrawal) daily.withdrawn += absAmount;

                // Fund timeline
                fundEntries.push({
                    date,
                    fundHouse: folio.fundHouse,
                    schemeName: folio.scheme.current_name,
                    investedAmount: isInvestment ? absAmount : 0,
                    withdrawnAmount: isWithdrawal ? absAmount : 0,
                });

                // Annual
                if (!annualMap.has(year)) {
                    annualMap.set(year, { invested: 0, withdrawn: 0 });
                }
                const annual = annualMap.get(year)!;
                if (isInvestment) annual.invested += absAmount;
                if (isWithdrawal) annual.withdrawn += absAmount;
            }
        }

        // Sort daily by date
        const daily: DailyTimeline[] = Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, { invested, withdrawn }]) => ({
                date,
                investedAmount: Math.round(invested * 100) / 100,
                withdrawnAmount: Math.round(withdrawn * 100) / 100,
            }));

        // Sort fund entries by date
        const byFund = fundEntries.sort((a, b) => a.date.localeCompare(b.date));

        // Annual cashflows sorted by year
        const annualCashflows: AnnualCashflow[] = Array.from(annualMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([year, { invested, withdrawn }]) => ({
                year,
                invested: Math.round(invested * 100) / 100,
                withdrawn: Math.round(withdrawn * 100) / 100,
                netCashflow: Math.round((invested - withdrawn) * 100) / 100,
            }));

        return { daily, byFund, annualCashflows };
    }
}
