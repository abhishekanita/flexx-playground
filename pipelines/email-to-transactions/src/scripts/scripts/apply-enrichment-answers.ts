import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { TransactionModel } from '@/schema/transaction.schema';
import { EnrichmentQuestionModel, EnrichmentQuestionType, EnrichmentQuestionStatus } from '@/schema/enrichment-question.schema';
import { TransactionFolderModel, FolderType } from '@/schema/transaction-folder.schema';

const USER_ID = '69a4500be8ae76d9b62883f2';

(async () => {
    await databaseLoader();

    const answered = await EnrichmentQuestionModel.find({
        status: EnrichmentQuestionStatus.Answered,
    }).sort({ impact: -1 });

    console.log(`Found ${answered.length} answered questions to apply\n`);

    let totalUpdated = 0;
    let foldersCreated = 0;

    for (const q of answered) {
        const answer = q.answer;
        if (!answer) continue;

        const txnIds = q.context.transactionIds;
        const txnUpdate: Record<string, any> = {};

        switch (q.type) {
            // === Transaction-level enrichment ===
            case EnrichmentQuestionType.IdentifyCategory:
            case EnrichmentQuestionType.IdentifyRecurring:
            case EnrichmentQuestionType.Freeform:
                if (answer.category) txnUpdate.category = answer.category;
                if (answer.merchantName) txnUpdate.merchant_name = answer.merchantName;
                if (answer.subCategory) txnUpdate.sub_category = answer.subCategory;
                break;

            case EnrichmentQuestionType.TransferOrSpending:
                if (answer.isTransfer) {
                    txnUpdate.category = 'transfer';
                } else if (answer.category) {
                    txnUpdate.category = answer.category;
                }
                if (answer.merchantName) txnUpdate.merchant_name = answer.merchantName;
                break;

            case EnrichmentQuestionType.IdentifyVpa:
                if (answer.merchantName) txnUpdate.merchant_name = answer.merchantName;
                if (answer.category) txnUpdate.category = answer.category;
                break;

            case EnrichmentQuestionType.MergeMerchants:
                if (answer.mergeIntoMerchant) txnUpdate.merchant_name = answer.mergeIntoMerchant;
                if (answer.category) txnUpdate.category = answer.category;
                break;

            case EnrichmentQuestionType.IdentifySubscription:
                if (answer.category) txnUpdate.category = answer.category;
                if (answer.merchantName) txnUpdate.merchant_name = answer.merchantName;
                break;

            // === Folder creation ===
            case EnrichmentQuestionType.SuggestTripFolder:
            case EnrichmentQuestionType.SuggestFamilyFolder:
            case EnrichmentQuestionType.ConfirmFolder: {
                if (!answer.folderName) break;

                const folderType = answer.folderType === 'trip' ? FolderType.Trip
                    : answer.folderType === 'family' ? FolderType.Family
                    : answer.folderType === 'event' ? FolderType.Event
                    : answer.folderType === 'work' ? FolderType.Work
                    : FolderType.Custom;

                // Create or find the folder
                let folder;
                if (answer.assignToFolder) {
                    folder = await TransactionFolderModel.findById(answer.assignToFolder);
                }

                if (!folder) {
                    folder = await TransactionFolderModel.create({
                        user_id: USER_ID,
                        name: answer.folderName,
                        type: folderType,
                        icon: answer.folderIcon || (folderType === FolderType.Trip ? '✈️' : folderType === FolderType.Family ? '👨‍👩‍👧' : '📁'),
                        rules: [],
                        includedTxnIds: txnIds,
                        excludedTxnIds: [],
                        description: answer.notes || '',
                        dateFrom: q.context.dateRange?.from,
                        dateTo: q.context.dateRange?.to,
                        totalAmount: q.context.totalAmount,
                        txnCount: txnIds.length,
                        isDefault: false,
                        isArchived: false,
                    });
                    foldersCreated++;
                    console.log(`  [FOLDER] Created "${answer.folderName}" (${folderType}) with ${txnIds.length} txns`);
                } else {
                    await TransactionFolderModel.findByIdAndUpdate(folder._id, {
                        $addToSet: { includedTxnIds: { $each: txnIds } },
                        $inc: { txnCount: txnIds.length },
                    });
                }

                // Tag transactions with folder ID
                if (folder) {
                    await TransactionModel.updateMany(
                        { _id: { $in: txnIds } },
                        { $addToSet: { folder_ids: folder._id.toString() } }
                    );
                }
                break;
            }

            // === Rule creation ===
            case EnrichmentQuestionType.SuggestRule: {
                if (!answer.createRule) break;

                // Apply the category to current txns
                if (answer.category) txnUpdate.category = answer.category;
                if (answer.merchantName) txnUpdate.merchant_name = answer.merchantName;

                // Create a folder rule for future auto-assignment
                if (answer.ruleField && answer.ruleValue) {
                    // Find or create a folder that should own this rule
                    const targetCategory = answer.category || q.context.categories[0] || 'other';
                    const targetFolder = await TransactionFolderModel.findOne({
                        user_id: USER_ID,
                        rules: { $elemMatch: { field: 'category', value: { $in: [targetCategory] } } },
                    });

                    if (targetFolder) {
                        await TransactionFolderModel.findByIdAndUpdate(targetFolder._id, {
                            $push: {
                                rules: {
                                    field: answer.ruleField,
                                    op: answer.ruleOp || 'eq',
                                    value: answer.ruleValue,
                                },
                            },
                        });
                        console.log(`  [RULE] Added rule to "${targetFolder.name}": ${answer.ruleField} ${answer.ruleOp || 'eq'} "${answer.ruleValue}"`);
                    }
                }
                break;
            }
        }

        // Apply transaction updates
        if (Object.keys(txnUpdate).length > 0) {
            txnUpdate.needs_review = false;
            txnUpdate.last_enriched_at = new Date();

            const result = await TransactionModel.updateMany(
                { _id: { $in: txnIds } },
                { $set: txnUpdate, $inc: { enrichment_score: 10 } }
            );

            console.log(`  [OK] ${result.modifiedCount}/${txnIds.length} txns — ${q.type}: "${q.question.substring(0, 60)}..."`);
            totalUpdated += result.modifiedCount;
        }

        // Mark as applied
        await EnrichmentQuestionModel.findByIdAndUpdate(q._id, {
            status: EnrichmentQuestionStatus.Applied,
        });
    }

    console.log(`\nTotal: ${totalUpdated} transactions updated, ${foldersCreated} folders created`);
    process.exit(0);
})();
