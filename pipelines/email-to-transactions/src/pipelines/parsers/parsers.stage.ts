import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { parserConfigService } from '@/services/parsers/parser-config.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { IRawEmailsDoc, IParserConfigDoc } from '@/schema';
import { getCodeModule } from './helpers/code-modules.registry';
import { DeclarativeEngine } from './helpers/declarative-engine';
import { PDFParse } from 'pdf-parse';

export class ParserStage {
    constructor() {}

    async parseAll(userId: string) {
        const configs = await parserConfigService.getActiveConfigs(userId);
        if (configs.length === 0) {
            logger.warn('[Parser] No active parser configs found in database');
            return;
        }
        logger.info(`[Parser] Loaded ${configs.length} active parser configs from DB`);

        const emails = await rawEmailsService.getEmailsToBeMatched(userId);
        logger.info(`[Parser] Found ${emails.length} emails to match`);

        const creds = await gmailConnectionService.getCredentials(userId);
        if (!creds) throw new Error('No Gmail credentials');
        const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

        let matched = 0;
        let parsed = 0;
        let failed = 0;
        let unmatched = 0;

        for (const email of emails) {
            const config = this.matchEmailToConfig(email, configs);
            if (!config) {
                unmatched++;
                await rawEmailsService.update({ _id: email._id }, { status: 'unmatched', statusUpdatedAt: new Date().toISOString() });
                continue;
            }

            matched++;
            logger.info(`[Parser] Matched "${email.subject}" → ${config.id}`);

            try {
                const result = await this.processEmail(email, config, gmail);
                if (result) {
                    parsed++;

                    // Compute field-level results for stats
                    const fieldResults = this.computeFieldResults(result);
                    const confidence = this.computeConfidence(fieldResults);

                    await rawEmailsService.update(
                        { _id: email._id },
                        {
                            status: 'parsed',
                            statusUpdatedAt: new Date().toISOString(),
                            marchedParserId: config.id,
                            matchedParserVersion: config.version,
                            parsedData: {
                                domain: config.domain || 'transaction',
                                rawExtracted: result,
                                confidence,
                                missingFields: Object.entries(fieldResults)
                                    .filter(([, found]) => !found)
                                    .map(([name]) => name),
                                warnings: [],
                                parserVersion: config.version,
                                parsedAt: new Date().toISOString(),
                            },
                        }
                    );

                    // Record stats
                    await parserConfigService.recordAttempt(config.id, {
                        success: true,
                        confidence,
                        fieldResults,
                    });
                } else {
                    failed++;
                    await parserConfigService.recordAttempt(config.id, {
                        success: false,
                        confidence: 0,
                        fieldResults: {},
                    });
                }
            } catch (err: any) {
                failed++;
                logger.error(`[Parser] Failed "${email.subject}": ${err.message}`);
                await rawEmailsService.update(
                    { _id: email._id },
                    {
                        status: 'parse_failed',
                        statusUpdatedAt: new Date().toISOString(),
                        lastParseError: err.message,
                        $inc: { parseAttempts: 1 },
                    }
                );
                await parserConfigService.recordAttempt(config.id, {
                    success: false,
                    confidence: 0,
                    fieldResults: {},
                });
            }
        }

        logger.info(`[Parser] Done: ${matched} matched, ${parsed} parsed, ${failed} failed, ${unmatched} unmatched`);
    }

    // ── Matching ────────────────────────────────────────────────────────

    private matchEmailToConfig(email: IRawEmailsDoc, configs: IParserConfigDoc[]): IParserConfigDoc | null {
        for (const config of configs) {
            if (this.matchesConfig(email, config)) return config;
        }
        return null;
    }

    private matchesConfig(email: IRawEmailsDoc, config: IParserConfigDoc): boolean {
        const from = email.fromAddress?.toLowerCase() || '';
        const fromPattern = config.match.fromAddress;

        if (fromPattern.startsWith('/')) {
            const regex = this.parseRegexString(fromPattern);
            if (!regex || !regex.test(from)) return false;
        } else {
            if (!from.includes(fromPattern.toLowerCase())) return false;
        }

        if (config.match.subject) {
            const subject = email.subject || '';
            const subPattern = config.match.subject;

            if (subPattern.startsWith('/')) {
                const regex = this.parseRegexString(subPattern);
                if (!regex || !regex.test(subject)) return false;
            } else {
                if (!subject.toLowerCase().includes(subPattern.toLowerCase())) return false;
            }
        }

        return true;
    }

    private parseRegexString(str: string): RegExp | null {
        const match = str.match(/^\/(.+)\/([gimsuy]*)$/);
        if (!match) return null;
        try {
            return new RegExp(match[1], match[2]);
        } catch {
            return null;
        }
    }

    private async processEmail(email: IRawEmailsDoc, config: IParserConfigDoc, gmail: GmailPlugin): Promise<unknown | null> {
        let parseFn: ((content: string | Buffer) => unknown) | null = null;
        if (config.strategy === 'code') {
            parseFn = getCodeModule(config.codeModule || '');
            if (!parseFn) {
                logger.error(`[Parser] Code module "${config.codeModule}" not found in registry`);
                return null;
            }
        } else if (config.strategy === 'declarative') {
            if (!config.declarativeRules) {
                logger.error(`[Parser] No declarative rules for "${config.id}"`);
                return null;
            }
            const rules = config.declarativeRules;
            parseFn = (content: string | Buffer) => new DeclarativeEngine().runParser(content as string, rules);
        } else {
            logger.warn(`[Parser] Unknown strategy "${config.strategy}" for "${config.id}"`);
            return null;
        }
        if (config.source === 'xlsx') {
            const buffer = await this.downloadAttachment(email, config, gmail);
            if (!buffer) return null;
            logger.info(`[Parser] XLSX downloaded (${buffer.length} bytes)`);
            return parseFn(buffer);
        }
        if (config.source === 'body_html') {
            if (!email.bodyHtml) {
                logger.warn(`[Parser] No HTML body for "${email.subject}"`);
                return null;
            }
            return parseFn(email.bodyHtml);
        }
        if (config.source === 'body_text') {
            if (!email.bodyText) {
                logger.warn(`[Parser] No text body for "${email.subject}"`);
                return null;
            }
            return parseFn(email.bodyText);
        }
        if (config.source === 'pdf') {
            const buffer = await this.downloadAttachment(email, config, gmail);
            if (!buffer) return null;

            const passwords = config.attachment?.passwords || [''];
            const pdfText = await this.extractPdfText(buffer, passwords);
            if (!pdfText) {
                logger.error(`[Parser] Could not decrypt/parse PDF for "${email.subject}"`);
                return null;
            }
            return parseFn(pdfText);
        }
        logger.warn(`[Parser] Unknown source type "${config.source}" for "${config.id}"`);
        return null;
    }

    private async downloadAttachment(email: IRawEmailsDoc, config: IParserConfigDoc, gmail: GmailPlugin): Promise<Buffer | null> {
        const att = config.attachment;
        if (!att) {
            logger.warn(`[Parser] No attachment config for "${config.id}"`);
            return null;
        }
        const attachment = email.attachments?.find((a: any) => {
            if (att.pickBy === 'mimeType' && att.mimeTypes?.length) {
                return att.mimeTypes.includes(a.mimeType) || a.filename?.endsWith('.pdf') || a.filename?.endsWith('.xlsx');
            }
            if (att.pickBy === 'filename' && att.filenamePattern) {
                const regex = this.parseRegexString(att.filenamePattern);
                return regex ? regex.test(a.filename) : a.filename?.includes(att.filenamePattern);
            }
            return false;
        });
        if (!attachment) {
            logger.warn(`[Parser] No matching attachment for "${email.subject}"`);
            return null;
        }
        return this.downloadWithRetry(gmail, email.gmailMessageId, attachment.gmailAttachmentId);
    }

    private async downloadWithRetry(gmail: GmailPlugin, messageId: string, attachmentId: string, maxAttempts = 3): Promise<Buffer | null> {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await gmail.downloadAttachment(messageId, attachmentId);
            } catch (err: any) {
                logger.warn(`[Parser] Download attempt ${attempt + 1} failed: ${err.message}`);
                if (attempt < maxAttempts - 1) {
                    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                }
            }
        }
        return null;
    }

    private async extractPdfText(buffer: Buffer, passwords: string[]): Promise<string | null> {
        for (const password of passwords) {
            try {
                const parser = new PDFParse({
                    data: new Uint8Array(buffer),
                    password: password || undefined,
                });
                const result = await parser.getText();
                await parser.destroy();
                logger.info(`[Parser] PDF extracted${password ? ' with password' : ''}`);
                return result.text;
            } catch (err: any) {
                logger.warn(`[Parser] PDF parse failed${password ? ` (pw: ${password.slice(0, 3)}...)` : ''}: ${err.message}`);
            }
        }
        return null;
    }

    private computeFieldResults(result: unknown): Record<string, boolean> {
        if (!result || typeof result !== 'object') return {};
        const fields: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
            if (Array.isArray(value)) {
                fields[key] = value.length > 0;
            } else if (typeof value === 'number') {
                fields[key] = true; // numbers are always "found" (even 0)
            } else if (typeof value === 'string') {
                fields[key] = value.length > 0;
            } else if (typeof value === 'object' && value !== null) {
                fields[key] = Object.keys(value).length > 0;
            } else {
                fields[key] = value !== null && value !== undefined;
            }
        }
        return fields;
    }

    private computeConfidence(fieldResults: Record<string, boolean>): number {
        const entries = Object.values(fieldResults);
        if (entries.length === 0) return 0;
        const found = entries.filter(Boolean).length;
        return parseFloat((found / entries.length).toFixed(3));
    }
}
