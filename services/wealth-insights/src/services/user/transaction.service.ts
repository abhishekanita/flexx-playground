import { createHash } from 'crypto';
import { BaseService } from '../base-service';
import { IMFUserTransactionDoc, MFUserTransactionModel } from '@/schema/user/user-transactions.schema';
import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { MFUserTransaction } from '@/types/storage/user-transaction.type';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('TransactionService');

export class TransactionService extends BaseService<IMFUserTransactionDoc> {
    constructor() {
        super(MFUserTransactionModel);
    }

    /**
     * Compute a dedup key for a transaction.
     * hash(pan + folioNumber + date + type + units + amount)
     */
    private computeDedupKey(
        pan: string,
        folioNumber: string,
        date: string,
        type: string,
        units: number,
        amount: number | null,
    ): string {
        const raw = `${pan}|${folioNumber}|${date}|${type}|${units}|${amount ?? 'null'}`;
        return createHash('md5').update(raw).digest('hex');
    }

    /**
     * Bulk insert transactions from a parsed statement.
     * Dedup via unique index on dedupKey -- duplicates fail silently.
     * Returns count of newly inserted transactions.
     */
    async bulkInsertFromStatement(pan: string, email: string, data: MFDetailedStatementData): Promise<{ inserted: number; duplicates: number }> {
        const allTxns: Partial<MFUserTransaction>[] = [];

        for (const folio of data.folios) {
            for (const tx of folio.transactions) {
                const dedupKey = this.computeDedupKey(
                    pan,
                    folio.folioNumber,
                    tx.date,
                    tx.type,
                    tx.units,
                    tx.amount,
                );

                allTxns.push({
                    pan,
                    email,
                    folioNumber: folio.folioNumber,
                    schemeName: folio.scheme.current_name,
                    isin: folio.scheme.isin,
                    date: tx.date,
                    type: tx.type,
                    channel: tx.channel || null,
                    advisorCode: tx.advisorCode || null,
                    amount: tx.amount,
                    nav: tx.nav,
                    units: tx.units,
                    unitBalanceAfter: tx.unitBalanceAfter,
                    stampDuty: tx.stampDuty,
                    dedupKey,
                });
            }
        }

        if (allTxns.length === 0) {
            return { inserted: 0, duplicates: 0 };
        }

        try {
            // ordered: false allows partial inserts -- duplicates fail silently
            const result = await this.model.insertMany(allTxns, { ordered: false });
            const inserted = result.length;
            const duplicates = allTxns.length - inserted;
            log.info(`Inserted ${inserted} new transactions, ${duplicates} duplicates skipped for PAN ${pan.slice(-4)}`);
            return { inserted, duplicates };
        } catch (err: any) {
            // BulkWriteError with duplicate key errors is expected
            if (err.code === 11000 || err.name === 'BulkWriteError' || err.name === 'MongoBulkWriteError') {
                const inserted = err.insertedDocs?.length ?? err.result?.insertedCount ?? 0;
                const duplicates = allTxns.length - inserted;
                log.info(`Inserted ${inserted} new transactions, ${duplicates} duplicates skipped for PAN ${pan.slice(-4)}`);
                return { inserted, duplicates };
            }
            throw err;
        }
    }

    async getTransactionsByPan(pan: string, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [docs, total] = await Promise.all([
            this.model.find({ pan }).sort({ date: -1 }).skip(skip).limit(limit).lean(),
            this.model.countDocuments({ pan }),
        ]);
        return { docs, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Backfill email on existing transactions that don't have it.
     */
    async backfillEmail(pan: string, email: string): Promise<number> {
        const result = await this.model.updateMany(
            { pan, $or: [{ email: { $exists: false } }, { email: null }, { email: '' }] },
            { $set: { email } },
        );
        return result.modifiedCount;
    }

    async getTransactionsByFolio(pan: string, folioNumber: string) {
        return this.model.find({ pan, folioNumber }).sort({ date: -1 }).lean();
    }

    async getTransactionCount(pan: string): Promise<number> {
        return this.model.countDocuments({ pan });
    }
}

export const transactionService = new TransactionService();
