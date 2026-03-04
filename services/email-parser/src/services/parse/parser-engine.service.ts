import { Types } from 'mongoose';
import { RawEmail, IRawEmailDoc } from '@/schema/raw-email.schema';
import { parserConfigLoader } from '@/services/parse/parser-config-loader';
import { templateApplier } from '@/services/parse/template-applier';
import { llmExtractor } from '@/services/parse/llm-extractor';
import { pdfExtractor } from '@/services/parse/pdf-extractor';
import type { ParserConfig } from '@/types/parser.types';

export interface ParseStageResult {
    parsed: number;
    failed: number;
    skipped: number;
    llmCostUSD: number;
}

export class ParserEngineService {
    /**
     * Stage 3: Parse all classified raw emails.
     * Dispatches to TemplateApplier, LLMExtractor, or PdfExtractor based on parser config method.
     */
    async parseEmails(
        userId: Types.ObjectId,
        accessToken?: string,
        refreshToken?: string
    ): Promise<ParseStageResult> {
        const emails = await RawEmail.find({ userId, status: 'classified' });

        let parsed = 0;
        let failed = 0;
        let skipped = 0;
        let llmCostUSD = 0;

        for (const email of emails) {
            // Find matching parser config
            const config = parserConfigLoader.getParserConfig(
                email.fromDomain,
                email.subject,
                email.date
            );

            if (!config) {
                // No parser config — skip
                email.status = 'skipped';
                email.parseResult = {
                    parserConfigId: '',
                    method: 'none',
                    extractedData: {},
                    targetCollection: '',
                    confidence: 0,
                    attempts: 1,
                    error: 'No parser config found',
                };
                await email.save();
                skipped++;
                continue;
            }

            try {
                const result = await this.parseEmail(email, config, accessToken, refreshToken);
                email.status = 'parsed';
                email.parseResult = {
                    parserConfigId: config.configId,
                    method: config.extraction.method,
                    extractedData: result.extractedData,
                    targetCollection: config.output.targetCollection,
                    confidence: result.confidence,
                    attempts: (email.parseResult?.attempts || 0) + 1,
                };

                if (result.costUSD) llmCostUSD += result.costUSD;

                parsed++;
            } catch (err: any) {
                email.status = 'failed';
                email.parseResult = {
                    parserConfigId: config.configId,
                    method: config.extraction.method,
                    extractedData: {},
                    targetCollection: config.output.targetCollection,
                    confidence: 0,
                    attempts: (email.parseResult?.attempts || 0) + 1,
                    error: err.message,
                };
                failed++;
                logger.warn(`[ParserEngine] Failed to parse email ${email.gmailMessageId}: ${err.message}`);
            }

            await email.save();
        }

        logger.info(`[ParserEngine] Parsed ${parsed}, failed ${failed}, skipped ${skipped}. LLM cost: $${llmCostUSD.toFixed(4)}`);
        return { parsed, failed, skipped, llmCostUSD };
    }

    private async parseEmail(
        email: IRawEmailDoc,
        config: ParserConfig,
        accessToken?: string,
        refreshToken?: string
    ): Promise<{ extractedData: Record<string, any>; confidence: number; costUSD?: number }> {
        switch (config.extraction.method) {
            case 'template': {
                if (!config.extraction.template) throw new Error('Template config missing');
                const result = templateApplier.apply(email.bodyHtml, config.extraction.template);

                if (result.fieldsExtracted === 0) {
                    throw new Error(`Template extracted 0 fields. Errors: ${result.errors.join(', ')}`);
                }

                const data = { ...result.extractedData };
                if (result.lineItems.length > 0) {
                    data.lineItems = result.lineItems;
                }

                const totalFields = result.fieldsExtracted + result.fieldsFailed;
                const confidence = totalFields > 0 ? result.fieldsExtracted / totalFields : 0;

                return { extractedData: data, confidence };
            }

            case 'llm': {
                if (!config.extraction.llm) throw new Error('LLM config missing');

                const result = await llmExtractor.extract(email.bodyHtml, config.extraction.llm, {
                    senderKey: config.classification.senderKey,
                    subject: email.subject,
                    emailDate: email.date?.toISOString() || '',
                });

                return {
                    extractedData: result.extractedData,
                    confidence: 0.9, // LLM extractions are generally high-confidence
                    costUSD: result.costUSD,
                };
            }

            case 'pdf-template': {
                if (!config.extraction.pdfTemplate) throw new Error('PDF template config missing');
                if (!accessToken || !refreshToken) throw new Error('Gmail credentials required for PDF extraction');

                // Find the first PDF attachment
                const pdfAttachment = email.attachments.find(
                    (a) => a.mimeType === 'application/pdf' || a.filename.endsWith('.pdf')
                );
                if (!pdfAttachment) throw new Error('No PDF attachment found');

                const result = await pdfExtractor.extractFromAttachment(
                    accessToken,
                    refreshToken,
                    email.gmailMessageId,
                    pdfAttachment.gmailAttachmentId,
                    pdfAttachment.filename,
                    config.extraction.pdfTemplate
                );

                return {
                    extractedData: {
                        accountNumber: result.accountNumber,
                        openingBalance: result.openingBalance,
                        closingBalance: result.closingBalance,
                        transactions: result.transactions,
                    },
                    confidence: result.transactions.length > 0 ? 0.85 : 0.3,
                };
            }

            case 'pdf-llm':
                throw new Error('pdf-llm extraction not yet implemented');

            default:
                throw new Error(`Unknown extraction method: ${config.extraction.method}`);
        }
    }
}

export const parserEngineService = new ParserEngineService();
