import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { parserConfigService } from '@/services/parsers/parser-config.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { IRawEmailsDoc, IParserConfigDoc } from '@/schema';
import { getCodeModule } from './helpers/code-modules.registry';
import { DeclarativeEngine } from './helpers/declarative-engine';
import { PDFParse } from 'pdf-parse';
import { userService } from '@/services/users/user.service';
import { PARSER_CONFIGS } from './helpers/parser-registry';

export class ParserStage {
    constructor() {}

    async parseAll(userId: string) {
        const configs = await parserConfigService.getActiveConfigs(userId);
        // const config = await parserConfigService.getBySlug('sbi_savings_statement');
        // console.log('config', config);
        // const configs = [config];
        // const configs = PARSER_CONFIGS;
        if (configs.length === 0) {
            logger.warn('[Parser] No active parser configs found in database');
            return;
        }
        logger.info(`[Parser] Loaded ${configs.length} active parser configs from DB`);

        const emails = await rawEmailsService.getEmailsToBeMatched(userId);
        const userMeta = await userService.getUserMeta(userId);
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
                const result = await this.processEmail(email, config, gmail, userMeta);
                if (result) {
                    parsed++;

                    // Compute field-level results for stats
                    const fieldResults = this.computeFieldResults(result);
                    const confidence = this.computeConfidence(fieldResults);
                    console.log('fieldResults', fieldResults, result, confidence);

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
                    continue;
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

    private async processEmail(email: IRawEmailsDoc, config: IParserConfigDoc, gmail: GmailPlugin, userMeta: any): Promise<unknown | null> {
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

            const passwordStrategy = config.attachment?.passwordStrategy || [''];
            const passwords = this.getPasswords(passwordStrategy, userMeta);
            console.log('passwords', passwords, passwordStrategy);
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

    /**
     * Password strategy DSL — template strings with `{field}` or `{field:modifier}` tokens.
     *
     * Fields:   name, dob, phone, crn
     * Slicing:  first3, last5, etc.
     * DOB fmt:  DDMM, DDMMYY, DDMMYYYY, YYYYMMDD
     *
     * Examples:
     *   "{name:first4}{dob:DDMM}"       → "abhi1804"
     *   "{phone:last5}{dob:DDMMYY}"     → "38083180497"
     *   "{phone}"                        → "9814838083"
     *   "{crn}"                          → "12345678"
     */
    private getPasswords(strategies: string[], userMeta: any): string[] {
        if (!strategies || strategies.length === 0) return [''];

        console.log('userMeta', userMeta);
        const passwords: string[] = [];
        const tokenRe = /\{(\w+)(?::(\w+))?\}/g;

        for (const tpl of strategies) {
            try {
                // Find all tokens, resolve each to string[]
                const tokens: { start: number; end: number; values: string[] }[] = [];
                let m: RegExpExecArray | null;
                while ((m = tokenRe.exec(tpl)) !== null) {
                    tokens.push({
                        start: m.index,
                        end: m.index + m[0].length,
                        values: this.resolveToken(m[1], m[2], userMeta),
                    });
                }

                if (tokens.length === 0) {
                    // No tokens — treat as literal password
                    passwords.push(tpl);
                    continue;
                }

                // Build cartesian product of all token values
                let combos: string[][] = [[]];
                for (const token of tokens) {
                    combos = combos.flatMap(prev => token.values.map(v => [...prev, v]));
                }

                // Stitch each combo back into the template
                for (const combo of combos) {
                    let result = '';
                    let cursor = 0;
                    for (let i = 0; i < tokens.length; i++) {
                        result += tpl.slice(cursor, tokens[i].start) + combo[i];
                        cursor = tokens[i].end;
                    }
                    result += tpl.slice(cursor);
                    if (result) passwords.push(result);
                }
            } catch (err: any) {
                logger.warn(`[Parser] Failed to resolve password strategy "${tpl}": ${err.message}`);
            }
        }

        passwords.push('');
        return [...new Set(passwords)];
    }

    private resolveToken(field: string, modifier: string | undefined, meta: any): string[] {
        switch (field) {
            case 'name': {
                const raw = (meta?.fullname || '').replace(/\s+/g, '');
                if (!raw) return [];
                const lower = this.sliceBy(raw.toLowerCase(), modifier);
                const upper = this.sliceBy(raw.toUpperCase(), modifier);
                return lower === upper ? [lower] : [lower, upper];
            }
            case 'dob': {
                const dob = meta?.dob || '';
                const [dd, mm, yyyy] = dob.split('-');
                if (!dd || !mm || !yyyy) return [];
                const formatted = this.formatDob(dd, mm, yyyy, modifier);
                return formatted ? [formatted] : [];
            }
            case 'phone': {
                const phones: string[] = meta?.phones || [];
                return phones
                    .map(p => p.replace(/\D/g, '').slice(-10))
                    .filter(Boolean)
                    .map(digits => this.sliceBy(digits, modifier));
            }
            case 'pan': {
                const pan = meta?.pan || '';
                return pan ? [this.sliceBy(pan, modifier)] : [];
            }
            case 'crn': {
                const crn = meta?.kotakCrn || '';
                return crn ? [this.sliceBy(crn, modifier)] : [];
            }
            default:
                return [];
        }
    }

    private formatDob(dd: string, mm: string, yyyy: string, fmt?: string): string {
        switch (fmt?.toUpperCase()) {
            case 'DDMM':
                return `${dd}${mm}`;
            case 'DDMMYY':
                return `${dd}${mm}${yyyy.slice(-2)}`;
            case 'DDMMYYYY':
                return `${dd}${mm}${yyyy}`;
            case 'YYYYMMDD':
                return `${yyyy}${mm}${dd}`;
            case 'MMDD':
                return `${mm}${dd}`;
            case 'MMYYYY':
                return `${mm}${yyyy}`;
            case undefined:
                return `${dd}${mm}${yyyy}`;
            default:
                return this.sliceBy(`${dd}${mm}${yyyy}`, fmt);
        }
    }

    private sliceBy(value: string, modifier?: string): string {
        if (!modifier) return value;
        const m = modifier.match(/^(first|last)(\d+)$/i);
        if (!m) return value;
        const n = parseInt(m[2]);
        return m[1].toLowerCase() === 'first' ? value.slice(0, n) : value.slice(-n);
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
