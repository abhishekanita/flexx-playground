import { ITransactionFolderDoc, TransactionFolderModel } from '@/schema/transaction-folder.schema';
import { BaseService } from '../base-service';

class TransactionFolderService extends BaseService<ITransactionFolderDoc> {
    constructor() {
        super(TransactionFolderModel);
    }

    async findByUser(userId: string) {
        return this.model.find({ user_id: userId, isArchived: false }).sort({ isDefault: -1, name: 1 });
    }

    async findDefaults(userId: string) {
        return this.model.find({ user_id: userId, isDefault: true });
    }

    async addTransactions(folderId: string, txnIds: string[]) {
        return this.model.findByIdAndUpdate(folderId, {
            $addToSet: { includedTxnIds: { $each: txnIds } },
        }, { new: true });
    }

    async removeTransactions(folderId: string, txnIds: string[]) {
        return this.model.findByIdAndUpdate(folderId, {
            $pull: { includedTxnIds: { $in: txnIds } },
            $addToSet: { excludedTxnIds: { $each: txnIds } },
        }, { new: true });
    }

    async updateCounts(folderId: string, txnCount: number, totalAmount: number) {
        return this.model.findByIdAndUpdate(folderId, {
            txnCount, totalAmount,
        }, { new: true });
    }
}

export const transactionFolderService = new TransactionFolderService();
