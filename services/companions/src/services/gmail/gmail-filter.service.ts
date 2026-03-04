import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { config } from '@/config';
import { EmailSenderModel } from '@/schema';
import { EmailCategory, EmailSender, FilterStage, SenderCategory } from '@/types';
import { GmailParsedMessage } from '@/plugins/gmail/gmail.type';
import logger, { ServiceLogger } from '@/utils/logger';
import { calculateCost, formatCost, type TokenUsage } from '@/utils/ai-cost';

const MODEL_ID = 'gpt-4.1-nano';

const openai = createOpenAI({
    apiKey: config.openai.apiKey,
});

// ─── AI Classification Schema ────────────────────────────────────────────────

const ClassificationSchema = z.object({
    isFinancial: z.boolean().describe('Is this a financial/transactional email?'),
    category: z.enum([
        'bank_transaction', 'upi_transaction', 'credit_card', 'loan_emi',
        'loan_disbursement', 'salary_credit', 'investment_statement',
        'mutual_fund', 'stock_trading', 'insurance_premium', 'insurance_policy',
        'tax_notice', 'tax_refund', 'itr_filing', 'invoice', 'subscription',
        'food_delivery', 'ecommerce', 'travel_booking', 'utility_bill',
        'wallet_transaction', 'other_financial', 'not_financial',
    ]).describe('Email category'),
    confidence: z.number().min(0).max(1).describe('Classification confidence 0-1'),
    senderCategory: z.enum([
        'bank', 'upi', 'credit_card', 'nbfc', 'insurance', 'mutual_fund',
        'stock_broker', 'tax_authority', 'food_delivery', 'ecommerce',
        'travel', 'utility', 'wallet', 'government', 'other',
    ]).describe('Sender organization type'),
});

const CLASSIFY_SYSTEM = `You classify Indian financial emails. Determine if an email is financial/transactional.
Financial = bank alerts, UPI, credit card, loan, salary, investment, insurance, tax, invoices, bills, subscriptions.
NOT financial = marketing, newsletters, promotions, social, spam, OTP-only, general notifications.
Be aggressive — only mark truly financial/transactional emails as financial.`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FilteredEmail {
    message: GmailParsedMessage;
    filterStage: FilterStage;
    category: EmailCategory;
    senderMatch?: EmailSender;
}

export interface FilterStats {
    total: number;
    whitelistMatched: number;
    aiClassified: number;
    discarded: number;
    aiCostUsd: number;
    newSendersFlagged: number;
}

// ─── Filter Service ──────────────────────────────────────────────────────────

export class GmailFilterService {
    private log: ServiceLogger;
    private senderCache: Map<string, EmailSender | null> = new Map();

    constructor() {
        this.log = logger.createServiceLogger('GmailFilter');
    }

    /**
     * Filter a batch of messages through Stage B (whitelist) + Stage C (AI).
     */
    async filterMessages(messages: GmailParsedMessage[]): Promise<{ filtered: FilteredEmail[]; stats: FilterStats }> {
        const stats: FilterStats = {
            total: messages.length,
            whitelistMatched: 0,
            aiClassified: 0,
            discarded: 0,
            aiCostUsd: 0,
            newSendersFlagged: 0,
        };

        // Load whitelist into cache
        await this.loadSenderCache();

        const filtered: FilteredEmail[] = [];
        const unknowns: GmailParsedMessage[] = [];

        // Stage B: Whitelist check
        for (const msg of messages) {
            const senderEmail = this.extractEmail(msg.from);
            const match = this.findSenderMatch(senderEmail);

            if (match) {
                const category = this.senderCategoryToEmailCategory(match.category, msg.subject);
                filtered.push({
                    message: msg,
                    filterStage: 'whitelist_match',
                    category,
                    senderMatch: match,
                });
                stats.whitelistMatched++;

                // Update match stats (fire-and-forget)
                EmailSenderModel.updateOne(
                    { emailPattern: match.emailPattern },
                    { $inc: { matchCount: 1 }, $set: { lastMatchAt: new Date() } }
                ).exec();
            } else {
                unknowns.push(msg);
            }
        }

        this.log.info(`Stage B (whitelist): ${stats.whitelistMatched} matched, ${unknowns.length} unknown`);

        // Stage C: AI classification for unknowns
        if (unknowns.length > 0) {
            const aiResults = await this.classifyWithAI(unknowns);

            for (const result of aiResults) {
                if (result.isFinancial) {
                    filtered.push({
                        message: result.message,
                        filterStage: 'ai_classified',
                        category: result.category as EmailCategory,
                    });
                    stats.aiClassified++;

                    // Auto-flag new sender for review
                    await this.flagNewSender(result.message, result.senderCategory, result.category as EmailCategory);
                    stats.newSendersFlagged++;
                } else {
                    stats.discarded++;
                }

                stats.aiCostUsd += result.costUsd;
            }

            this.log.info(`Stage C (AI): ${stats.aiClassified} financial, ${stats.discarded} discarded, cost: ${formatCost(stats.aiCostUsd)}`);
        }

        return { filtered, stats };
    }

    // ─── Whitelist Matching ──────────────────────────────────────────────────

    private async loadSenderCache(): Promise<void> {
        if (this.senderCache.size > 0) return;

        const senders = await EmailSenderModel.find({ status: 'active' }).lean<EmailSender[]>();
        for (const sender of senders) {
            this.senderCache.set(sender.emailPattern.toLowerCase(), sender);
            if (sender.domainPattern) {
                this.senderCache.set(sender.domainPattern.toLowerCase(), sender);
            }
        }

        this.log.info(`Loaded ${senders.length} senders into whitelist cache`);
    }

    private findSenderMatch(email: string): EmailSender | null {
        const emailLower = email.toLowerCase();

        // Exact email pattern match
        for (const [pattern, sender] of this.senderCache) {
            if (!sender) continue;

            if (pattern.startsWith('*@')) {
                // Wildcard domain match: *@domain.com
                const domain = pattern.substring(2);
                if (emailLower.endsWith(`@${domain}`)) return sender;
            } else if (emailLower === pattern) {
                return sender;
            } else if (emailLower.includes(pattern)) {
                return sender;
            }
        }

        // Domain-based match
        const domain = emailLower.split('@')[1];
        if (domain) {
            const domainMatch = this.senderCache.get(domain);
            if (domainMatch) return domainMatch;
        }

        return null;
    }

    private extractEmail(fromHeader: string): string {
        const match = fromHeader.match(/<([^>]+)>/);
        return match ? match[1] : fromHeader.trim();
    }

    /**
     * Map sender category to a best-guess email category.
     * The parser will refine this based on email content.
     */
    private senderCategoryToEmailCategory(senderCategory: SenderCategory, subject: string): EmailCategory {
        const subjectLower = subject.toLowerCase();

        // Try subject-based refinement first
        if (subjectLower.includes('upi') || subjectLower.includes('vpa')) return 'upi_transaction';
        if (subjectLower.includes('emi')) return 'loan_emi';
        if (subjectLower.includes('salary') || subjectLower.includes('credited to your')) return 'salary_credit';
        if (subjectLower.includes('credit card') || subjectLower.includes('card statement')) return 'credit_card';
        if (subjectLower.includes('sip') || subjectLower.includes('mutual fund') || subjectLower.includes('nav')) return 'mutual_fund';
        if (subjectLower.includes('insurance') || subjectLower.includes('premium')) return 'insurance_premium';
        if (subjectLower.includes('tax') || subjectLower.includes('itr') || subjectLower.includes('form 16')) return 'tax_notice';
        if (subjectLower.includes('invoice') || subjectLower.includes('receipt')) return 'invoice';

        // Fall back to sender category mapping
        const categoryMap: Record<SenderCategory, EmailCategory> = {
            bank: 'bank_transaction',
            upi: 'upi_transaction',
            credit_card: 'credit_card',
            nbfc: 'loan_emi',
            insurance: 'insurance_premium',
            mutual_fund: 'mutual_fund',
            stock_broker: 'stock_trading',
            tax_authority: 'tax_notice',
            food_delivery: 'food_delivery',
            ecommerce: 'ecommerce',
            travel: 'travel_booking',
            utility: 'utility_bill',
            wallet: 'wallet_transaction',
            government: 'other_financial',
            other: 'other_financial',
        };

        return categoryMap[senderCategory] || 'other_financial';
    }

    // ─── AI Classification (Stage C) ────────────────────────────────────────

    private async classifyWithAI(
        messages: GmailParsedMessage[]
    ): Promise<Array<{
        message: GmailParsedMessage;
        isFinancial: boolean;
        category: string;
        senderCategory: string;
        costUsd: number;
    }>> {
        const results = [];

        // Process in batches of 5 to manage concurrency
        for (let i = 0; i < messages.length; i += 5) {
            const batch = messages.slice(i, i + 5);

            const batchResults = await Promise.allSettled(
                batch.map(async (msg) => {
                    const attachmentText = Object.values(msg.attachmentTexts).join('\n').substring(0, 500);
                    const bodyText = (msg.textBody || msg.snippet).substring(0, 500);

                    let prompt = `From: ${msg.from}\nSubject: ${msg.subject}\nDate: ${msg.date.toISOString()}\n\nBody (first 500 chars):\n${bodyText}`;
                    if (attachmentText) {
                        prompt += `\n\nPDF Attachment Text (first 500 chars):\n${attachmentText}`;
                    }

                    const { object, usage } = await generateObject({
                        model: openai(MODEL_ID),
                        schema: ClassificationSchema,
                        system: CLASSIFY_SYSTEM,
                        prompt,
                        temperature: 0,
                    });

                    const tokenUsage: TokenUsage = {
                        inputTokens: usage.inputTokens ?? 0,
                        outputTokens: usage.outputTokens ?? 0,
                        cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
                        cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
                    };
                    const cost = calculateCost(MODEL_ID, tokenUsage);

                    return {
                        message: msg,
                        isFinancial: object.isFinancial && object.category !== 'not_financial',
                        category: object.category,
                        senderCategory: object.senderCategory,
                        costUsd: cost.totalCost,
                    };
                })
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    this.log.error(`AI classification failed: ${result.reason?.message}`);
                }
            }
        }

        return results;
    }

    // ─── Auto-flag New Senders ───────────────────────────────────────────────

    private async flagNewSender(msg: GmailParsedMessage, senderCategory: string, emailCategory: EmailCategory): Promise<void> {
        const email = this.extractEmail(msg.from);
        const domain = email.split('@')[1];
        if (!domain) return;

        const pattern = `*@${domain}`;

        // Check if already exists
        const exists = await EmailSenderModel.findOne({ emailPattern: pattern });
        if (exists) return;

        // Extract sender name from "Name <email>" format
        const nameMatch = msg.from.match(/^([^<]+)</);
        const senderName = nameMatch ? nameMatch[1].trim().replace(/"/g, '') : domain;

        await EmailSenderModel.create({
            emailPattern: pattern,
            domainPattern: domain,
            senderName,
            category: senderCategory as any,
            processingConfig: {
                extractionType: 'ai',
                expectedFields: [],
                subjectPatterns: [msg.subject],
                priority: 0,
            },
            status: 'pending_review',
            matchCount: 1,
            lastMatchAt: new Date(),
        });

        this.log.yellow(`  Flagged new sender: ${pattern} (${senderName}) as ${senderCategory}`);
    }
}
