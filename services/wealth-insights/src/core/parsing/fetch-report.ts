import { gmailAuthService } from '../../services/gmail/gmail-auth.service';
import { gmailPlugin } from '@/plugins/google/gmail.plugin';
import { GmailParsedMessage } from '@/plugins/google/gmail.type';
import logger from '@/utils/logger';
import { gmail_v1 } from 'googleapis';

const RETRY_COUNT = 10;

export class FetchReport {
    private gmail: gmail_v1.Gmail;

    private static EMAIL_ADDRESS = 'donotreply@camsonline.com';
    private static SUBJECT_PATTERN = 'Consolidated Account Statement';

    constructor() {}

    async init(email: string) {
        this.gmail = await gmailAuthService.getGmailClient(email);
    }

    async checkForStatementEmail(refNumber: string, statementSendTs: Date) {
        let attempt = 0;
        const subjectPattern = FetchReport.SUBJECT_PATTERN;
        logger.info(`[FetchJob] Check #${attempt + 1}/${RETRY_COUNT} for ${refNumber})`);
        try {
            const today = new Date(statementSendTs);
            const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
            const query = `from:${FetchReport.EMAIL_ADDRESS} subject:"${subjectPattern}" after:${dateStr}`;
            const messageIds = await gmailPlugin.fetchMessageIds(this.gmail, query, 10);
            const messages = await gmailPlugin.fetchMessages(this.gmail, messageIds);
            for (const message of messages) {
                const hasRefAttachment = message.attachments.findIndex(a => a.filename?.includes(refNumber)) !== -1;
                console.log('hasRefAttachment', hasRefAttachment, message.attachments, refNumber);
                if (hasRefAttachment) {
                    return message;
                }
            }
            return null;
        } catch (err: any) {}
    }

    async downloadAttachement(message: GmailParsedMessage) {
        // // Fetch attachments as buffers
        const attachments: { name: string; data: Buffer; url: string }[] = [];
        for (const att of message.attachments) {
            const data = await gmailPlugin.fetchAttachmentData(this.gmail, message.id, att.attachmentId);
            attachments.push({
                name: att.filename,
                data,
                url: '',
            });
        }
        return attachments;
    }
}
