import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { config } from '@/config';
import { EmailProcessingTemplateModel, FinancialEmailModel } from '@/schema';
import {
    EmailCategory,
    FinancialEmailData,
    FinancialEmailAiUsage,
    ProcessingMethod,
    TemplateRule,
    EmailProcessingTemplate,
} from '@/types';
import { GmailParsedMessage } from '@/plugins/gmail/gmail.type';
import { FilteredEmail } from './gmail-filter.service';
import logger, { ServiceLogger } from '@/utils/logger';
import { calculateCost, formatCost, type TokenUsage } from '@/utils/ai-cost';

const MODEL_ID = 'gpt-4.1-nano';

const openai = createOpenAI({
    apiKey: config.openai.apiKey,
});

// ─── AI Extraction Schema ────────────────────────────────────────────────────

const ExtractionSchema = z.object({
    amount: z.number().nullable().describe('Transaction/payment amount'),
    currency: z.string().default('INR').describe('Currency code'),
    date: z.string().nullable().describe('Transaction date (ISO format)'),
    merchantName: z.string().nullable().describe('Merchant or payee name'),
    accountNumberLast4: z.string().nullable().describe('Last 4 digits of account'),
    transactionType: z.enum(['debit', 'credit']).nullable().describe('Debit or credit'),
    upiId: z.string().nullable().describe('UPI VPA if present'),
    referenceNumber: z.string().nullable().describe('Transaction/reference ID'),
    balance: z.number().nullable().describe('Available balance after transaction'),
    bankName: z.string().nullable().describe('Bank name'),
    cardLast4: z.string().nullable().describe('Last 4 digits of card'),
    emiNumber: z.number().nullable().describe('Current EMI number'),
    emiTotal: z.number().nullable().describe('Total EMI count'),
    policyNumber: z.string().nullable().describe('Insurance policy number'),
    invoiceNumber: z.string().nullable().describe('Invoice/order number'),
    taxYear: z.string().nullable().describe('Assessment year for tax'),
    description: z.string().nullable().describe('Brief description of transaction'),
});

const TemplateGenerationSchema = z.object({
    rules: z.array(z.object({
        field: z.string().describe('Target field name (e.g. amount, merchantName)'),
        method: z.enum(['regex', 'text_between']).describe('Extraction method'),
        pattern: z.string().optional().describe('Regex pattern with capture group'),
        startMarker: z.string().optional().describe('Text before target value'),
        endMarker: z.string().optional().describe('Text after target value'),
        transform: z.enum(['number', 'date', 'uppercase', 'lowercase', 'trim']).optional(),
        group: z.number().optional().describe('Regex capture group index (default 1)'),
    })).describe('Extraction rules for this email format'),
});

const EXTRACT_SYSTEM = `Extract structured financial data from Indian financial emails.
Focus on: amount, date, merchant, account details, reference numbers, balance.
For UPI: extract VPA/UPI ID. For loans: extract EMI info. For tax: extract AY.
Return null for fields not present in the email. Be precise with numbers.`;

const TEMPLATE_SYSTEM = `Generate extraction rules for a financial email format.
Create regex patterns or text_between markers that can extract structured data from emails with this format.
Rules should be robust enough to work on future emails from the same sender with the same format.
Use named capture groups where possible. Test patterns mentally against the provided text.`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParseResult {
    data: FinancialEmailData;
    processingMethod: ProcessingMethod;
    aiUsage?: FinancialEmailAiUsage;
    templateId?: string;
}

export interface ParserStats {
    totalParsed: number;
    templateExtractions: number;
    aiExtractions: number;
    templatesGenerated: number;
    aiCostUsd: number;
    errors: number;
}

// ─── Parser Service ──────────────────────────────────────────────────────────

export class GmailParserService {
    private log: ServiceLogger;
    private templateCache: Map<string, EmailProcessingTemplate> = new Map();

    constructor() {
        this.log = logger.createServiceLogger('GmailParser');
    }

    /**
     * Parse a batch of filtered emails. Uses template when available, AI otherwise.
     */
    async parseEmails(
        filteredEmails: FilteredEmail[],
        connectionId: string
    ): Promise<ParserStats> {
        const stats: ParserStats = {
            totalParsed: 0,
            templateExtractions: 0,
            aiExtractions: 0,
            templatesGenerated: 0,
            aiCostUsd: 0,
            errors: 0,
        };

        // Load template cache
        await this.loadTemplateCache();

        // Process sequentially to manage AI costs
        for (const email of filteredEmails) {
            try {
                const result = await this.parseOne(email);

                // Store in MongoDB
                await FinancialEmailModel.create({
                    connectionId,
                    gmailMessageId: email.message.id,
                    threadId: email.message.threadId,
                    from: email.message.from,
                    to: email.message.to,
                    subject: email.message.subject,
                    receivedAt: email.message.date,
                    filterStage: email.filterStage,
                    category: email.category,
                    processingMethod: result.processingMethod,
                    data: result.data,
                    attachments: email.message.attachments.map((a) => ({
                        filename: a.filename,
                        mimeType: a.mimeType,
                        size: a.size,
                        extractedText: email.message.attachmentTexts[a.filename]?.substring(0, 10000),
                    })),
                    rawText: email.message.textBody?.substring(0, 5000),
                    rawHtml: email.message.htmlBody?.substring(0, 10000),
                    senderEmailPattern: email.senderMatch?.emailPattern,
                    templateId: result.templateId,
                    aiUsage: result.aiUsage,
                    processedAt: new Date(),
                });

                stats.totalParsed++;
                if (result.processingMethod === 'template_extraction') {
                    stats.templateExtractions++;
                } else {
                    stats.aiExtractions++;
                    if (result.aiUsage) stats.aiCostUsd += result.aiUsage.costUsd;
                }
            } catch (err: any) {
                if (err.code === 11000) {
                    // Duplicate gmailMessageId — skip silently
                    this.log.warn(`  Skipping duplicate: ${email.message.id}`);
                } else {
                    this.log.error(`  Failed to parse "${email.message.subject.substring(0, 50)}": ${err.message}`);
                    stats.errors++;
                }
            }
        }

        this.log.info(
            `Parsing complete: ${stats.totalParsed} parsed (${stats.templateExtractions} template, ${stats.aiExtractions} AI), ` +
            `${stats.templatesGenerated} templates generated, ${stats.errors} errors, AI cost: ${formatCost(stats.aiCostUsd)}`
        );

        return stats;
    }

    // ─── Single Email Parsing ────────────────────────────────────────────────

    private async parseOne(email: FilteredEmail): Promise<ParseResult> {
        const senderEmail = this.extractEmail(email.message.from);
        const domain = senderEmail.split('@')[1] || '';
        const pattern = `*@${domain}`;

        // Check for template
        const template = this.findTemplate(pattern, email.category);

        if (template && template.status === 'active') {
            // Template extraction (free)
            const data = this.applyTemplate(template, email.message);

            if (data && Object.keys(data).length > 1) {
                // Update template usage
                EmailProcessingTemplateModel.updateOne(
                    { _id: (template as any)._id },
                    { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
                ).exec();

                return {
                    data,
                    processingMethod: 'template_extraction',
                    templateId: (template as any)._id?.toString(),
                };
            }
            // Template didn't extract enough — fall through to AI
        }

        // AI extraction
        const { data, aiUsage } = await this.extractWithAI(email);

        // Auto-generate template for this sender format
        if (data && Object.keys(data).length > 2) {
            await this.autoGenerateTemplate(email, data);
            // Not counting stats here — it's a side effect
        }

        return {
            data: data || {},
            processingMethod: 'ai_extraction',
            aiUsage,
        };
    }

    // ─── Template Extraction (Free) ──────────────────────────────────────────

    private async loadTemplateCache(): Promise<void> {
        if (this.templateCache.size > 0) return;

        const templates = await EmailProcessingTemplateModel.find({ status: 'active' }).lean<EmailProcessingTemplate[]>();
        for (const t of templates) {
            const key = `${t.senderEmailPattern}::${t.category}`;
            this.templateCache.set(key, t);
        }

        this.log.info(`Loaded ${templates.length} active templates`);
    }

    private findTemplate(senderPattern: string, category: EmailCategory): EmailProcessingTemplate | null {
        const key = `${senderPattern}::${category}`;
        return this.templateCache.get(key) || null;
    }

    private applyTemplate(template: EmailProcessingTemplate, message: GmailParsedMessage): FinancialEmailData | null {
        const bodyText = message.textBody || message.htmlBody || '';
        const attachmentText = Object.values(message.attachmentTexts).join('\n');

        // Try attachment text first (primary data source), then fall back to body
        const textsToTry = attachmentText ? [attachmentText, bodyText] : [bodyText];
        if (!textsToTry.some((t) => t)) return null;

        const data: Record<string, any> = {};

        for (const rule of template.rules) {
            try {
                let value: string | null = null;

                for (const text of textsToTry) {
                    if (!text) continue;

                    if (rule.method === 'regex' && rule.pattern) {
                        const match = text.match(new RegExp(rule.pattern, 'i'));
                        if (match) {
                            value = match[rule.group || 1] || match[0];
                        }
                    } else if (rule.method === 'text_between' && rule.startMarker && rule.endMarker) {
                        const startIdx = text.indexOf(rule.startMarker);
                        if (startIdx !== -1) {
                            const afterStart = startIdx + rule.startMarker.length;
                            const endIdx = text.indexOf(rule.endMarker, afterStart);
                            if (endIdx !== -1) {
                                value = text.substring(afterStart, endIdx).trim();
                            }
                        }
                    }

                    if (value !== null) break; // Found in this text source, no need to try next
                }

                if (value !== null) {
                    data[rule.field] = this.applyTransform(value, rule.transform);
                }
            } catch {
                // Skip failed rules silently
            }
        }

        return Object.keys(data).length > 0 ? (data as FinancialEmailData) : null;
    }

    private applyTransform(value: string, transform?: string): any {
        if (!transform) return value.trim();

        switch (transform) {
            case 'number':
                return parseFloat(value.replace(/[^0-9.-]/g, '')) || null;
            case 'date':
                return new Date(value) || null;
            case 'uppercase':
                return value.toUpperCase();
            case 'lowercase':
                return value.toLowerCase();
            case 'trim':
                return value.trim();
            default:
                return value;
        }
    }

    // ─── AI Extraction ───────────────────────────────────────────────────────

    private async extractWithAI(
        email: FilteredEmail
    ): Promise<{ data: FinancialEmailData | null; aiUsage: FinancialEmailAiUsage }> {
        const msg = email.message;
        const attachmentText = Object.values(msg.attachmentTexts).join('\n').substring(0, 3000);
        const bodyText = (msg.textBody || msg.htmlBody || msg.snippet).substring(0, 2000);

        // Attachment text gets priority — it's typically the primary data source (bank statement PDF, etc.)
        let contentBlock = '';
        if (attachmentText) {
            contentBlock += `PDF Attachment Text (primary source):\n${attachmentText}\n\n`;
        }
        contentBlock += `Email Body:\n${bodyText}`;

        const prompt = `Category: ${email.category}\nFrom: ${msg.from}\nSubject: ${msg.subject}\nDate: ${msg.date.toISOString()}\n\n${contentBlock}`;

        const { object, usage } = await generateObject({
            model: openai(MODEL_ID),
            schema: ExtractionSchema,
            system: EXTRACT_SYSTEM,
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

        // Clean nulls
        const data: Record<string, any> = {};
        for (const [key, val] of Object.entries(object)) {
            if (val !== null && val !== undefined && val !== '') {
                data[key] = val;
            }
        }

        return {
            data: Object.keys(data).length > 0 ? (data as FinancialEmailData) : null,
            aiUsage: {
                model: MODEL_ID,
                inputTokens: tokenUsage.inputTokens,
                outputTokens: tokenUsage.outputTokens,
                costUsd: cost.totalCost,
            },
        };
    }

    // ─── Auto Template Generation ────────────────────────────────────────────

    private async autoGenerateTemplate(email: FilteredEmail, extractedData: FinancialEmailData): Promise<void> {
        const senderEmail = this.extractEmail(email.message.from);
        const domain = senderEmail.split('@')[1] || '';
        const pattern = `*@${domain}`;

        // Check if template already exists
        const existing = await EmailProcessingTemplateModel.findOne({
            senderEmailPattern: pattern,
            category: email.category,
        });
        if (existing) return;

        try {
            const bodyText = (email.message.textBody || email.message.htmlBody || '').substring(0, 2000);

            const prompt = `Sender: ${email.message.from}\nSubject: ${email.message.subject}\nCategory: ${email.category}\n\nExtracted data:\n${JSON.stringify(extractedData, null, 2)}\n\nEmail body:\n${bodyText}`;

            const { object } = await generateObject({
                model: openai(MODEL_ID),
                schema: TemplateGenerationSchema,
                system: TEMPLATE_SYSTEM,
                prompt,
                temperature: 0,
            });

            if (object.rules.length > 0) {
                await EmailProcessingTemplateModel.create({
                    senderEmailPattern: pattern,
                    subjectPattern: email.message.subject.replace(/[0-9]/g, '\\d').substring(0, 200),
                    category: email.category,
                    rules: object.rules as TemplateRule[],
                    status: 'draft', // Starts as draft, needs validation before active
                    accuracy: 0,
                    usageCount: 0,
                    createdFrom: 'ai_generated',
                });

                this.log.cyan(`  Auto-generated template for ${pattern} (${email.category}) with ${object.rules.length} rules`);
            }
        } catch (err: any) {
            this.log.warn(`  Failed to auto-generate template: ${err.message}`);
        }
    }

    private extractEmail(fromHeader: string): string {
        const match = fromHeader.match(/<([^>]+)>/);
        return match ? match[1] : fromHeader.trim();
    }
}
