import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    // 1. Find all SBI Card statement emails
    const emails = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: { $regex: 'sbicard.com', $options: 'i' },
    });

    console.log('=== All sbicard.com emails ===');
    for (const e of emails) {
        console.log(JSON.stringify({
            id: (e as any)._id?.toString(),
            subject: e.subject,
            from: e.fromAddress,
            date: e.receivedAt,
            hasPdf: (e as any).hasPdf,
            attCount: e.attachments?.length,
            attachments: e.attachments?.map((a: any) => ({ name: a.filename, mime: a.mimeType, downloaded: a.downloaded })),
        }));
    }

    // 2. Filter to actual statement emails (not marketing)
    const statements = emails.filter(e =>
        e.subject?.toLowerCase().includes('statement')
    );
    console.log(`\n=== Statement emails: ${statements.length} ===`);
    for (const e of statements) {
        console.log(`  ${e.receivedAt} | ${e.subject} | atts: ${e.attachments?.length}`);
    }

    // 3. Also check HDFC and ICICI CC statements
    const hdfcStatements = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: { $regex: 'hdfcbank', $options: 'i' },
        subject: { $regex: 'statement', $options: 'i' },
    });
    console.log(`\n=== HDFC statement emails: ${hdfcStatements.length} ===`);
    for (const e of hdfcStatements) {
        console.log(JSON.stringify({
            subject: e.subject,
            from: e.fromAddress,
            date: e.receivedAt,
            hasPdf: (e as any).hasPdf,
            attCount: e.attachments?.length,
            attachments: e.attachments?.map((a: any) => ({ name: a.filename, mime: a.mimeType })),
        }));
    }

    const iciciStatements = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: { $regex: 'icici', $options: 'i' },
        subject: { $regex: 'statement|credit card', $options: 'i' },
    });
    console.log(`\n=== ICICI statement-related emails: ${iciciStatements.length} ===`);
    for (const e of iciciStatements) {
        console.log(JSON.stringify({
            subject: e.subject,
            from: e.fromAddress,
            date: e.receivedAt,
            hasPdf: (e as any).hasPdf,
            attCount: e.attachments?.length,
            attachments: e.attachments?.map((a: any) => ({ name: a.filename, mime: a.mimeType })),
        }));
    }

    // 4. Try downloading one SBI Card statement PDF and check password
    if (statements.length > 0) {
        const sample = statements[0];
        const creds = await gmailConnectionService.getCredentials(USER_ID);
        const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

        const att = sample.attachments?.find((a: any) => a.mimeType === 'application/pdf' || a.filename?.endsWith('.pdf'));
        if (att) {
            console.log(`\n=== Downloading SBI Card PDF: ${att.filename} ===`);
            const buf = await gmail.downloadAttachment((sample as any).gmailMessageId, att.gmailAttachmentId);
            console.log(`Downloaded ${buf.length} bytes`);

            // Try without password first
            try {
                const parser = new PDFParse({ data: new Uint8Array(buf) });
                const result = await parser.getText();
                await parser.destroy();
                console.log('PDF is NOT password protected!');
                console.log('First 500 chars:', result.text.substring(0, 500));

                const outDir = path.join(process.cwd(), 'output', 'sbicard');
                fs.mkdirSync(outDir, { recursive: true });
                fs.writeFileSync(path.join(outDir, 'sample-no-pw.txt'), result.text);
            } catch (e: any) {
                console.log('PDF is password protected:', e.message);

                // Check the email body for password hints
                console.log('\n=== Email body (first 2000 chars) ===');
                const bodyText = sample.bodyText || '';
                const bodyHtml = sample.bodyHtml || '';
                console.log('Body text:', bodyText.substring(0, 2000));
                if (!bodyText && bodyHtml) {
                    // Strip HTML tags for readability
                    const stripped = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    console.log('Body html (stripped):', stripped.substring(0, 2000));
                }
            }
        } else {
            console.log('\nNo PDF attachment found on first statement email');
            // Check body for statement content
            console.log('Body text length:', sample.bodyText?.length);
            console.log('Body HTML length:', sample.bodyHtml?.length);
        }
    }

    // 5. Also check HDFC CC PDF
    const hdfcWithPdf = hdfcStatements.filter((e: any) => e.hasPdf);
    if (hdfcWithPdf.length > 0) {
        const sample = hdfcWithPdf[0];
        const creds = await gmailConnectionService.getCredentials(USER_ID);
        const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

        const att = sample.attachments?.find((a: any) => a.mimeType === 'application/pdf' || a.filename?.endsWith('.pdf'));
        if (att) {
            console.log(`\n=== Downloading HDFC CC PDF: ${att.filename} ===`);
            const buf = await gmail.downloadAttachment((sample as any).gmailMessageId, att.gmailAttachmentId);
            console.log(`Downloaded ${buf.length} bytes`);

            try {
                const parser = new PDFParse({ data: new Uint8Array(buf) });
                const result = await parser.getText();
                await parser.destroy();
                console.log('HDFC PDF is NOT password protected!');
                console.log('First 500 chars:', result.text.substring(0, 500));

                const outDir = path.join(process.cwd(), 'output', 'hdfc-cc');
                fs.mkdirSync(outDir, { recursive: true });
                fs.writeFileSync(path.join(outDir, 'sample-no-pw.txt'), result.text);
            } catch (e: any) {
                console.log('HDFC PDF is password protected:', e.message);
                console.log('\nEmail body hint:');
                const bodyText = sample.bodyText || '';
                const bodyHtml = sample.bodyHtml || '';
                const text = bodyText || bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                console.log(text.substring(0, 2000));
            }
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
