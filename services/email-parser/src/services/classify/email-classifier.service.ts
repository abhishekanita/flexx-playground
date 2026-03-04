import { Types } from 'mongoose';
import { RawEmail, IRawEmailDoc } from '@/schema/raw-email.schema';
import { parserConfigLoader } from '@/services/parse/parser-config-loader';

export interface ClassifyResult {
    classified: number;
    unclassified: number;
    byCategory: Record<string, number>;
}

export class EmailClassifierService {
    /**
     * Stage 2: Classify all fetched raw emails.
     * Tries parser configs first (more specific), then falls back to category rules.
     */
    async classifyEmails(userId: Types.ObjectId): Promise<ClassifyResult> {
        const emails = await RawEmail.find({ userId, status: 'fetched' });

        let classified = 0;
        let unclassified = 0;
        const byCategory: Record<string, number> = {};

        for (const email of emails) {
            const result = this.classifyEmail(email);

            if (result) {
                email.category = result.category;
                email.subcategory = result.subcategory;
                email.senderKey = result.senderKey;
                email.templateKey = result.templateKey || '';
                email.status = 'classified';
                classified++;
                byCategory[result.category] = (byCategory[result.category] || 0) + 1;
            } else {
                email.category = 'uncategorized';
                email.status = 'classified';
                unclassified++;
                byCategory['uncategorized'] = (byCategory['uncategorized'] || 0) + 1;
            }

            await email.save();
        }

        logger.info(`[EmailClassifier] Classified ${classified}, uncategorized ${unclassified} of ${emails.length} emails`);
        return { classified, unclassified, byCategory };
    }

    private classifyEmail(email: IRawEmailDoc): {
        category: string;
        subcategory: string;
        senderKey: string;
        templateKey?: string;
    } | null {
        // Try parser configs first — they're more specific and have template keys
        const parserConfig = parserConfigLoader.getParserConfig(
            email.fromDomain,
            email.subject,
            email.date
        );

        if (parserConfig) {
            return {
                category: parserConfig.classification.category,
                subcategory: parserConfig.classification.subcategory,
                senderKey: parserConfig.classification.senderKey,
                templateKey: `${parserConfig.configId}.v${parserConfig.version}`,
            };
        }

        // Fall back to category rules
        const categoryRule = parserConfigLoader.classifyEmail(
            email.fromDomain,
            email.subject
        );

        if (categoryRule) {
            return {
                category: categoryRule.category,
                subcategory: categoryRule.subcategory,
                senderKey: categoryRule.senderKey,
            };
        }

        return null;
    }
}

export const emailClassifierService = new EmailClassifierService();
