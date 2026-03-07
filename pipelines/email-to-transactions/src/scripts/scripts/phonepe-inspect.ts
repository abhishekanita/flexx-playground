import '@/loaders/logger';
import initServer from '@/loaders';
import { GmailPlugin } from '@/plugins/gmail/gmail.plugin';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { RawEmailsModel } from '@/schema/raw-emails.schema';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');

const run = async () => {
    await initServer();

    const userId = '69a4500be8ae76d9b62883f2';

    // 1. Get Gmail credentials
    const creds = await gmailConnectionService.getCredentials(userId);
    if (!creds) {
        console.error('No credentials found for user');
        process.exit(1);
    }
    console.log('Got credentials');

    // 2. Find the PhonePe transaction statement email
    const email = await RawEmailsModel.findOne({
        userId,
        subject: { $regex: /PhonePe transaction statement/i },
    }).lean();

    if (!email) {
        console.error('No PhonePe transaction statement email found');
        process.exit(1);
    }
    console.log('Found email:', email.subject);
    console.log('Attachments:', JSON.stringify(email.attachments, null, 2));

    // 3. Find PDF attachment
    const attachments = (email.attachments || []) as any[];
    const pdfAttachment = attachments.find((a: any) => a.mimeType === 'application/pdf' || (a.filename && a.filename.endsWith('.pdf')));

    if (!pdfAttachment) {
        console.error('No PDF attachment found in email');
        process.exit(1);
    }
    console.log('PDF attachment:', pdfAttachment.filename, pdfAttachment.gmailAttachmentId);

    // 4. Download the PDF
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);
    const buffer = await gmail.downloadAttachment(email.gmailMessageId, pdfAttachment.gmailAttachmentId);
    fs.writeFileSync('/tmp/phonepe_statement.pdf', buffer);
    console.log('Saved PDF to /tmp/phonepe_statement.pdf, size:', buffer.length, 'bytes');

    // 5. Parse PDF - try with password first
    console.log('\n=== Parsing with password ===');
    try {
        const parser = new PDFParse({ data: new Uint8Array(buffer), password: '7838237658' });
        const result = await parser.getText();
        console.log('\n--- EXTRACTED TEXT ---\n');
        console.log(result.text);
        console.log('\n--- END TEXT ---');
        console.log('Total pages:', result.total);
        await parser.destroy();
    } catch (err: any) {
        console.error('Parse with password failed:', err.message);

        // Try without password
        console.log('\n=== Parsing without password ===');
        try {
            const parser2 = new PDFParse({ data: new Uint8Array(buffer) });
            const result2 = await parser2.getText();
            console.log('\n--- EXTRACTED TEXT ---\n');
            console.log(result2.text);
            console.log('\n--- END TEXT ---');
            console.log('Total pages:', result2.total);
            await parser2.destroy();
        } catch (err2: any) {
            console.error('Parse without password also failed:', err2.message);
        }
    }

    process.exit(0);
};

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
