import { rawEmailsService } from '@/services/emails/emails.service';
import { GmailPlugin } from '@/plugins/gmail.plugin';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { matchEmailToProvider, ProviderConfig } from './provider-configs';
import { PDFParse } from 'pdf-parse';
import { IRawEmailsDoc } from '@/schema/raw-emails.schema';

export class ParserStage {
    constructor() {}

    async parseAll(userId: string) {
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
            const config = matchEmailToProvider(email);
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
                    await rawEmailsService.update(
                        { _id: email._id },
                        {
                            status: 'parsed',
                            statusUpdatedAt: new Date().toISOString(),
                            marchedParserId: config.id,
                            parsedData: {
                                domain: 'transaction',
                                rawExtracted: result,
                                confidence: 1,
                                missingFields: [],
                                warnings: [],
                                parsedAt: new Date().toISOString(),
                            },
                        }
                    );
                } else {
                    failed++;
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
            }
        }

        logger.info(`[Parser] Done: ${matched} matched, ${parsed} parsed, ${failed} failed, ${unmatched} unmatched`);
    }

    private async processEmail(email: IRawEmailsDoc, config: ProviderConfig, gmail: GmailPlugin): Promise<unknown | null> {
        // XLSX-based parsers — download and pass buffer directly
        if (config.source === 'xlsx') {
            if (!config.xlsx) {
                logger.warn(`[Parser] XLSX config missing for "${config.id}"`);
                return null;
            }

            const attachment = email.attachments?.find((a: any) => config.xlsx!.pickAttachment(a));
            if (!attachment) {
                logger.warn(`[Parser] No matching XLSX attachment for "${email.subject}"`);
                return null;
            }

            const xlsxBuffer = await this.downloadWithRetry(gmail, email.gmailMessageId, attachment.gmailAttachmentId);
            if (!xlsxBuffer) {
                logger.error(`[Parser] Failed to download XLSX for "${email.subject}"`);
                return null;
            }

            logger.info(`[Parser] XLSX downloaded (${xlsxBuffer.length} bytes)`);
            return config.parse(xlsxBuffer);
        }

        // Body-based parsers — no download needed
        if (config.source === 'body_html') {
            if (!email.bodyHtml) {
                logger.warn(`[Parser] No HTML body for "${email.subject}"`);
                return null;
            }
            return config.parse(email.bodyHtml);
        }

        if (config.source === 'body_text') {
            if (!email.bodyText) {
                logger.warn(`[Parser] No text body for "${email.subject}"`);
                return null;
            }
            return config.parse(email.bodyText);
        }

        // PDF-based parsers — download and extract
        if (!config.pdf) {
            logger.warn(`[Parser] PDF config missing for "${config.id}"`);
            return null;
        }

        const attachment = email.attachments?.find((a: any) => config.pdf!.pickAttachment(a));
        if (!attachment) {
            logger.warn(`[Parser] No matching attachment for "${email.subject}"`);
            return null;
        }

        const pdfBuffer = await this.downloadWithRetry(gmail, email.gmailMessageId, attachment.gmailAttachmentId);
        if (!pdfBuffer) {
            logger.error(`[Parser] Failed to download PDF for "${email.subject}"`);
            return null;
        }

        const pdfText = await this.extractPdfText(pdfBuffer, config.pdf.passwords);
        if (!pdfText) {
            logger.error(`[Parser] Could not decrypt/parse PDF for "${email.subject}"`);
            return null;
        }

        return config.parse(pdfText);
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
}
