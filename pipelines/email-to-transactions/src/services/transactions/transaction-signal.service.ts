import { ITransactionSignalDoc, TransactionSignalModel } from '@/schema/transaction-signal.schema';
import { BaseService } from '../base-service';

class TransactionSignalService extends BaseService<ITransactionSignalDoc> {
    constructor() {
        super(TransactionSignalModel);
    }

    async existsForEmail(rawEmailId: string) {
        return this.model.exists({ raw_email_id: rawEmailId });
    }
}

export const transactionSignalService = new TransactionSignalService();
