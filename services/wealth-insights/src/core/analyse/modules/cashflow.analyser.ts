import { MFDetailedStatementData } from '../../../types/statements/mf-statements.type';
import {
    CashflowAnalysisResult,
    AnnualCashflow,
    MonthlyCashflow,
} from '../../../types/analysis';

const INVESTMENT_TYPES = new Set([
    'Purchase', 'SIP', 'Switch In', 'STP In', 'NFO Allotment',
]);

const WITHDRAWAL_TYPES = new Set([
    'Redemption', 'SIP Redemption', 'SWP', 'Switch Out', 'STP Out', 'Dividend Payout',
]);

export class CashflowAnalyser {
    static analyse(data: MFDetailedStatementData): CashflowAnalysisResult {
        let totalInvested = 0;
        let totalWithdrawn = 0;
        let totalStampDuty = 0;

        const annualMap = new Map<number, { invested: number; withdrawn: number }>();
        const monthlyMap = new Map<string, { invested: number; withdrawn: number }>();

        for (const folio of data.folios) {
            totalStampDuty += folio.stampDutyTotal || 0;

            for (const tx of folio.transactions) {
                const amount = tx.amount;
                if (amount === null || amount === 0) continue;

                const absAmount = Math.abs(amount);
                const date = tx.date;
                const year = parseInt(date.substring(0, 4), 10);
                const month = date.substring(0, 7); // "YYYY-MM"

                const isInvestment = INVESTMENT_TYPES.has(tx.type);
                const isWithdrawal = WITHDRAWAL_TYPES.has(tx.type);

                if (isInvestment) totalInvested += absAmount;
                if (isWithdrawal) totalWithdrawn += absAmount;

                if (!isInvestment && !isWithdrawal) continue;

                // Annual
                if (!annualMap.has(year)) annualMap.set(year, { invested: 0, withdrawn: 0 });
                const annual = annualMap.get(year)!;
                if (isInvestment) annual.invested += absAmount;
                if (isWithdrawal) annual.withdrawn += absAmount;

                // Monthly
                if (!monthlyMap.has(month)) monthlyMap.set(month, { invested: 0, withdrawn: 0 });
                const monthly = monthlyMap.get(month)!;
                if (isInvestment) monthly.invested += absAmount;
                if (isWithdrawal) monthly.withdrawn += absAmount;
            }
        }

        const annualCashflows: AnnualCashflow[] = Array.from(annualMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([year, { invested, withdrawn }]) => ({
                year,
                invested: round2(invested),
                withdrawn: round2(withdrawn),
                netCashflow: round2(invested - withdrawn),
            }));

        const monthlyCashflows: MonthlyCashflow[] = Array.from(monthlyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, { invested, withdrawn }]) => ({
                month,
                invested: round2(invested),
                withdrawn: round2(withdrawn),
                netCashflow: round2(invested - withdrawn),
            }));

        return {
            totalInvested: round2(totalInvested),
            totalWithdrawn: round2(totalWithdrawn),
            totalStampDuty: round2(totalStampDuty),
            netCashflow: round2(totalInvested - totalWithdrawn),
            annualCashflows,
            monthlyCashflows,
        };
    }
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
