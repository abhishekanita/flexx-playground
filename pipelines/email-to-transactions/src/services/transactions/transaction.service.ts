import { ITransactionDoc, TransactionModel } from '@/schema/transaction.schema';
import { BaseService } from '../base-service';

class TransactionService extends BaseService<ITransactionDoc> {
    constructor() {
        super(TransactionModel);
    }

    async findByUpiRef(userId: string, upiRef: string) {
        return this.model.findOne({ user_id: userId, upi_ref: upiRef });
    }

    async findByNeftUtr(userId: string, neftUtr: string) {
        return this.model.findOne({ user_id: userId, neft_utr: neftUtr });
    }

    async findByImpsRef(userId: string, impsRef: string) {
        return this.model.findOne({ user_id: userId, imps_ref: impsRef });
    }

    async findByMerchantOrderId(userId: string, merchantOrderId: string) {
        return this.model.findOne({ user_id: userId, merchant_order_id: merchantOrderId });
    }

    async findByFingerprint(fingerprint: string) {
        return this.model.findOne({ fingerprint });
    }

    async findByAmountAndDateWindow(userId: string, amount: number, txDate: Date, windowHours = 24) {
        const start = new Date(txDate.getTime() - windowHours * 60 * 60 * 1000);
        const end = new Date(txDate.getTime() + windowHours * 60 * 60 * 1000);
        return this.model.find({
            user_id: userId,
            amount,
            tx_date: { $gte: start, $lte: end },
        });
    }

    async incrementSignalCount(txnId: string) {
        return this.model.updateOne(
            { _id: txnId },
            { $inc: { signal_count: 1 }, $set: { last_enriched_at: new Date() } }
        );
    }
}

export const transactionService = new TransactionService();
