import { IInvestmentHoldingDoc, InvestmentHoldingModel } from '@/schema/investment-holding.schema';
import { BaseService } from '../base-service';

class InvestmentHoldingService extends BaseService<IInvestmentHoldingDoc> {
    constructor() {
        super(InvestmentHoldingModel);
    }

    async findByIsin(userId: string, isin: string) {
        return this.model.find({ user_id: userId, isin });
    }

    async findByFolio(userId: string, folioNumber: string) {
        return this.model.findOne({ user_id: userId, folio_number: folioNumber });
    }

    async findActiveByAccount(accountId: string) {
        return this.model.find({ investment_account_id: accountId, status: 'active' });
    }

    /**
     * Replace all holdings for an account+source+snapshot_date.
     * Used when an authoritative statement (CAMS, NSDL CAS) arrives.
     */
    async replaceHoldings(
        accountId: string,
        source: string,
        snapshotDate: string,
        holdings: Partial<IInvestmentHoldingDoc>[]
    ) {
        // Mark old holdings from this source as stale (don't delete — keep history)
        await this.model.updateMany(
            { investment_account_id: accountId, source, status: 'active' },
            { $set: { status: 'stale', reconciliation_status: 'stale' } }
        );

        // Insert new holdings
        if (holdings.length > 0) {
            return this.model.insertMany(holdings);
        }
        return [];
    }
}

export const investmentHoldingService = new InvestmentHoldingService();
