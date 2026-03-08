import { IInvestmentTransactionDoc, InvestmentTransactionModel } from '@/schema/investment-transaction.schema';
import { BaseService } from '../base-service';

class InvestmentTransactionService extends BaseService<IInvestmentTransactionDoc> {
    constructor() {
        super(InvestmentTransactionModel);
    }

    async findByFingerprint(fingerprint: string) {
        return this.model.findOne({ fingerprint });
    }

    async findByIsinAndDate(userId: string, isin: string, txDate: string) {
        return this.model.find({ user_id: userId, isin, tx_date: txDate });
    }

    async findByContractNumber(userId: string, contractNumber: string) {
        return this.model.find({ user_id: userId, contract_number: contractNumber });
    }

    async existsForEmail(rawEmailId: string) {
        return this.model.exists({ source_email_id: rawEmailId });
    }

    async addSignalToExisting(txnId: string, signal: { source: string; email_id?: string; received_at: Date; parsed_data: Record<string, unknown> }) {
        return this.model.updateOne(
            { _id: txnId },
            {
                $push: { source_signals: signal },
                $inc: { signal_count: 1 },
                $set: { reconciliation_status: 'confirmed' },
            }
        );
    }
}

export const investmentTransactionService = new InvestmentTransactionService();
