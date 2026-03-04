import { Types } from 'mongoose';
import { RawEmail, IRawEmailDoc } from '@/schema/raw-email.schema';
import { Transaction } from '@/schema/transaction.schema';
import { Invoice } from '@/schema/invoice.schema';
import { OfficialStatement } from '@/schema/official-statement.schema';
import { EnrichmentLink } from '@/schema/enrichment-link.schema';
import { deduplicationService } from '@/services/reconcile/deduplication.service';
import { merchantResolverService } from '@/services/reconcile/merchant-resolver.service';
import { parserConfigLoader } from '@/services/parse/parser-config-loader';

export interface ReconcileResult {
    transactionsCreated: number;
    transactionsEnriched: number;
    invoicesCreated: number;
    statementsCreated: number;
    duplicatesSkipped: number;
}

export class ReconciliationService {
    /**
     * Stage 4: Reconcile parsed emails into transactions, invoices, and statements.
     */
    async reconcile(userId: Types.ObjectId): Promise<ReconcileResult> {
        const emails = await RawEmail.find({ userId, status: 'parsed' });

        const result: ReconcileResult = {
            transactionsCreated: 0,
            transactionsEnriched: 0,
            invoicesCreated: 0,
            statementsCreated: 0,
            duplicatesSkipped: 0,
        };

        for (const email of emails) {
            try {
                const target = email.parseResult?.targetCollection;

                switch (target) {
                    case 'invoices':
                        await this.reconcileInvoice(userId, email, result);
                        break;
                    case 'official_statements':
                        await this.reconcileStatement(userId, email, result);
                        break;
                    case 'transactions':
                        await this.reconcileTransaction(userId, email, result);
                        break;
                    default:
                        logger.warn(`[Reconcile] Unknown target collection: ${target}`);
                }

                email.status = 'enriched';
                await email.save();
            } catch (err: any) {
                logger.warn(`[Reconcile] Failed for email ${email.gmailMessageId}: ${err.message}`);
            }
        }

        logger.info(
            `[Reconcile] ${result.transactionsCreated} txns created, ${result.transactionsEnriched} enriched, ` +
            `${result.invoicesCreated} invoices, ${result.statementsCreated} statements, ${result.duplicatesSkipped} dupes`
        );

        return result;
    }

    private async reconcileInvoice(
        userId: Types.ObjectId,
        email: IRawEmailDoc,
        result: ReconcileResult
    ): Promise<void> {
        const data = email.parseResult?.extractedData || {};
        const merchantName = merchantResolverService.resolve(
            email.senderKey || email.fromDomain
        );

        // Check for existing invoice from this email
        const existingInvoice = await Invoice.findOne({ userId, rawEmailId: email._id });
        if (existingInvoice) {
            result.duplicatesSkipped++;
            await this.createEnrichmentLink(email._id, 'invoices', existingInvoice._id, 'duplicate_skipped', 1.0);
            return;
        }

        // Create invoice
        const invoice = await Invoice.create({
            userId,
            rawEmailId: email._id,
            merchantName,
            externalOrderId: data.orderId || data.externalOrderId,
            orderDate: data.date ? new Date(data.date) : email.date,
            subtotal: data.subtotal,
            taxes: data.taxes,
            deliveryFee: data.deliveryFee,
            discount: data.discount,
            totalAmount: data.totalAmount || 0,
            lineItems: (data.lineItems || []).map((li: any) => ({
                name: li.name,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                totalPrice: li.price || li.totalPrice || 0,
            })),
            paymentMethod: data.paymentMethod,
            senderKey: email.senderKey || '',
            parserConfigId: email.parseResult?.parserConfigId || '',
        });

        result.invoicesCreated++;
        await this.createEnrichmentLink(email._id, 'invoices', invoice._id, 'created', 1.0);

        // Try to match with existing transaction or create new one
        const amount = data.totalAmount || 0;
        const date = data.date ? new Date(data.date) : email.date;

        if (amount > 0) {
            const match = await deduplicationService.findDuplicate(
                userId,
                amount,
                date,
                merchantName,
                data.orderId || data.externalOrderId,
                email.senderKey
            );

            if (match && match.matchScore >= 0.5) {
                // Enrich existing transaction
                match.transaction.enrichment = {
                    hasInvoice: true,
                    invoiceId: invoice._id,
                    orderId: data.orderId || data.externalOrderId,
                    lineItems: invoice.lineItems,
                    paymentMethod: data.paymentMethod,
                };

                if (!match.transaction.sources.some((s) => s.rawEmailId?.toString() === email._id.toString())) {
                    match.transaction.sources.push({
                        type: 'email_receipt',
                        rawEmailId: email._id,
                        importedAt: new Date(),
                    });
                }

                invoice.transactionId = match.transaction._id;
                await Promise.all([match.transaction.save(), invoice.save()]);

                result.transactionsEnriched++;
                await this.createEnrichmentLink(
                    email._id,
                    'transactions',
                    match.transaction._id,
                    'enriched',
                    match.matchScore,
                    ['enrichment', 'sources']
                );
            } else {
                // Create new transaction from invoice
                const txn = await Transaction.create({
                    userId,
                    date,
                    amount,
                    type: 'debit',
                    currency: 'INR',
                    merchantName,
                    merchantRaw: email.senderKey || email.fromDomain,
                    channel: 'ONLINE',
                    enrichment: {
                        hasInvoice: true,
                        invoiceId: invoice._id,
                        orderId: data.orderId || data.externalOrderId,
                        lineItems: invoice.lineItems,
                        paymentMethod: data.paymentMethod,
                    },
                    sources: [{
                        type: 'email_receipt',
                        rawEmailId: email._id,
                        importedAt: new Date(),
                    }],
                    primarySource: 'email_receipt',
                    category: email.category,
                    subcategory: email.subcategory,
                });

                invoice.transactionId = txn._id;
                await invoice.save();

                result.transactionsCreated++;
                await this.createEnrichmentLink(email._id, 'transactions', txn._id, 'created', 1.0);
            }
        }
    }

    private async reconcileStatement(
        userId: Types.ObjectId,
        email: IRawEmailDoc,
        result: ReconcileResult
    ): Promise<void> {
        const data = email.parseResult?.extractedData || {};

        // Check for existing statement from this email
        const existing = await OfficialStatement.findOne({ userId, rawEmailId: email._id });
        if (existing) {
            result.duplicatesSkipped++;
            return;
        }

        const statement = await OfficialStatement.create({
            userId,
            rawEmailId: email._id,
            statementType: 'savings',
            provider: email.senderKey || email.fromDomain,
            accountNumber: data.accountNumber,
            statementPeriod: data.statementPeriod || {},
            openingBalance: data.openingBalance,
            closingBalance: data.closingBalance,
            parsedTransactions: (data.transactions || []).map((txn: any) => ({
                ...txn,
                synced: false,
            })),
        });

        result.statementsCreated++;
        await this.createEnrichmentLink(email._id, 'official_statements', statement._id, 'created', 1.0);

        // Create individual transactions from statement lines
        for (const stmtTxn of statement.parsedTransactions) {
            const merchantName = merchantResolverService.resolve(stmtTxn.merchant || stmtTxn.description);

            const match = await deduplicationService.findDuplicate(
                userId,
                stmtTxn.amount,
                stmtTxn.date,
                merchantName
            );

            if (match && match.matchScore >= 0.8) {
                // High-confidence match — enrich with bank data
                if (!match.transaction.sources.some((s) => s.statementId?.toString() === statement._id.toString())) {
                    match.transaction.sources.push({
                        type: 'bank_statement',
                        statementId: statement._id,
                        importedAt: new Date(),
                    });
                }
                match.transaction.balance = stmtTxn.balance;
                match.transaction.bankName = statement.provider;
                if (stmtTxn.channel) match.transaction.channel = stmtTxn.channel as any;
                await match.transaction.save();

                stmtTxn.synced = true;
                stmtTxn.transactionId = match.transaction._id;
                result.transactionsEnriched++;
            } else {
                // Create new transaction
                const txn = await Transaction.create({
                    userId,
                    date: stmtTxn.date,
                    amount: stmtTxn.amount,
                    type: stmtTxn.type,
                    currency: 'INR',
                    merchantName,
                    merchantRaw: stmtTxn.description,
                    channel: stmtTxn.channel || 'OTHER',
                    balance: stmtTxn.balance,
                    bankName: statement.provider,
                    sources: [{
                        type: 'bank_statement',
                        statementId: statement._id,
                        importedAt: new Date(),
                    }],
                    primarySource: 'bank_statement',
                    enrichment: { hasInvoice: false },
                });

                stmtTxn.synced = true;
                stmtTxn.transactionId = txn._id;
                result.transactionsCreated++;
            }
        }

        await statement.save();
    }

    private async reconcileTransaction(
        userId: Types.ObjectId,
        email: IRawEmailDoc,
        result: ReconcileResult
    ): Promise<void> {
        const data = email.parseResult?.extractedData || {};
        const merchantName = merchantResolverService.resolve(
            data.merchantName || email.senderKey || email.fromDomain
        );
        const amount = data.amount || 0;
        const date = data.date ? new Date(data.date) : email.date;

        if (amount <= 0) return;

        const match = await deduplicationService.findDuplicate(userId, amount, date, merchantName);

        if (match && match.matchScore >= 0.8) {
            result.duplicatesSkipped++;
            await this.createEnrichmentLink(email._id, 'transactions', match.transaction._id, 'duplicate_skipped', match.matchScore);
        } else {
            const txn = await Transaction.create({
                userId,
                date,
                amount,
                type: data.type || 'debit',
                currency: 'INR',
                merchantName,
                merchantRaw: data.merchantRaw || email.fromDomain,
                sources: [{
                    type: 'email_receipt',
                    rawEmailId: email._id,
                    importedAt: new Date(),
                }],
                primarySource: 'email_receipt',
                category: email.category,
                subcategory: email.subcategory,
                enrichment: { hasInvoice: false },
            });

            result.transactionsCreated++;
            await this.createEnrichmentLink(email._id, 'transactions', txn._id, 'created', 1.0);
        }
    }

    private async createEnrichmentLink(
        rawEmailId: Types.ObjectId,
        targetCollection: string,
        targetDocId: Types.ObjectId,
        linkType: 'created' | 'enriched' | 'duplicate_skipped',
        matchScore: number,
        fieldsEnriched: string[] = []
    ): Promise<void> {
        await EnrichmentLink.create({
            rawEmailId,
            targetCollection,
            targetDocId,
            linkType,
            matchScore,
            fieldsEnriched,
        });
    }
}

export const reconciliationService = new ReconciliationService();
