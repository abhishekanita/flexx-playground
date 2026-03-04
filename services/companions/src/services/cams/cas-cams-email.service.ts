import { gmail_v1 } from 'googleapis';
import { gmailPlugin } from '@/plugins/gmail/gmail.plugin';
import { casCamsPdfService } from './cas-cams-pdf.service';
import { CasCamsParsedData } from '@/types/cams-cas.type';
import logger, { ServiceLogger } from '@/utils/logger';

const DEFAULT_QUERY = 'from:camsonline.com subject:"Consolidated Account Statement"';

export interface CasEmailFetchOptions {
    searchQuery?: string;
    maxResults?: number;
}

export class CasCamsEmailService {
    private log: ServiceLogger;

    constructor() {
        this.log = logger.createServiceLogger('CasCamsEmail');
    }

    /**
     * Search Gmail for CAMS CAS statement emails, download the PDF attachment,
     * parse it, and return structured holdings data.
     */
    async fetchAndParseCasStatement(
        gmail: gmail_v1.Gmail,
        password: string,
        options?: CasEmailFetchOptions,
    ): Promise<CasCamsParsedData> {
        const query = options?.searchQuery || DEFAULT_QUERY;
        const maxResults = options?.maxResults || 5;

        // 1. Search for CAMS emails
        this.log.info(`Searching Gmail: "${query}"`);
        const messageIds = await gmailPlugin.fetchMessageIds(gmail, query, maxResults);

        if (messageIds.length === 0) {
            throw new Error('No CAMS CAS statement emails found. Check your Gmail query.');
        }
        this.log.info(`Found ${messageIds.length} matching email(s)`);

        // 2. Fetch the most recent message
        const messages = await gmailPlugin.fetchMessages(gmail, [messageIds[0]]);
        if (messages.length === 0) {
            throw new Error('Failed to fetch CAMS email content');
        }

        const message = messages[0];
        this.log.info(`Email: "${message.subject}" from ${message.from} (${message.date.toISOString()})`);

        // 3. Find PDF attachment
        const pdfAttachment = message.attachments.find(
            a => a.mimeType === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf'),
        );

        if (!pdfAttachment) {
            throw new Error(`No PDF attachment found in email "${message.subject}". Attachments: ${message.attachments.map(a => a.filename).join(', ') || 'none'}`);
        }
        this.log.info(`Found PDF: ${pdfAttachment.filename} (${(pdfAttachment.size / 1024).toFixed(1)} KB)`);

        // 4. Download the attachment
        this.log.info('Downloading PDF attachment...');
        const pdfBuffer = await gmailPlugin.fetchAttachment(gmail, message.id, pdfAttachment.attachmentId);
        this.log.info(`Downloaded: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

        // 5. Parse the PDF
        this.log.info('Parsing CAS PDF...');
        const parsed = await casCamsPdfService.parsePdf(pdfBuffer, password);
        this.log.green(`Parsed: ${parsed.holdings.length} holdings, ${parsed.loadsAndFees.length} load entries`);

        return parsed;
    }
}

export const casCamsEmailService = new CasCamsEmailService();
