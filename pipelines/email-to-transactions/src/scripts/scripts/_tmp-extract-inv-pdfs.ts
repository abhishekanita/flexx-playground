import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail/gmail.plugin';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

const PDF_PROVIDERS = [
    {
        name: 'zerodha-equity',
        from: 'no-reply-account-statement@reportsmailer.zerodha.net',
        subjectFilter: /Weekly Equity/i,
        pickAttachment: (a: any) => a.filename?.includes('securities-statement'),
    },
    {
        name: 'zerodha-demat',
        from: 'no-reply-transaction-with-holding-statement@reportsmailer.zerodha.net',
        pickAttachment: (a: any) => a.filename?.includes('transaction-with-holding'),
    },
    {
        name: 'indmoney',
        from: 'statements@transactions.indmoney.com',
        subjectFilter: /Weekly Statement/i,
        pickAttachment: (a: any) => a.filename?.endsWith('.PDF') || a.filename?.endsWith('.pdf'),
    },
    {
        name: 'bse',
        from: 'info@bseindia.in',
        pickAttachment: (a: any) => a.filename?.endsWith('.pdf'),
    },
    {
        name: 'nsdl-cas',
        from: 'nsdl-cas@nsdl.co.in',
        pickAttachment: (a: any) => a.filename?.includes('NSDLe-CAS'),
    },
    {
        name: 'icici-securities',
        from: 'service@icicisecurities.com',
        subjectFilter: /Equity Transaction Statement/i,
        pickAttachment: (a: any) => a.mimeType === 'application/pdf' || a.mimeType === 'application/octet-stream',
    },
];

async function main() {
    await databaseLoader();

    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    const outBase = path.join(process.cwd(), 'output', 'investment-pdfs');
    fs.mkdirSync(outBase, { recursive: true });

    for (const p of PDF_PROVIDERS) {
        console.log(`\n=== ${p.name} ===`);
        const emails = await rawEmailsService.find({ userId: USER_ID, fromAddress: p.from });
        let filtered = emails;
        if (p.subjectFilter) {
            filtered = emails.filter(e => p.subjectFilter!.test(e.subject || ''));
        }

        // Pick first email with matching attachment
        for (const e of filtered) {
            if (!e.attachments || e.attachments.length === 0) continue;
            const att = e.attachments.find((a: any) => p.pickAttachment(a));
            if (!att) continue;

            console.log(`  Email: "${e.subject}"`);
            console.log(`  Attachment: ${att.filename} (${att.mimeType})`);

            try {
                const buf = await gmail.downloadAttachment(e.gmailMessageId, att.gmailAttachmentId);
                const outDir = path.join(outBase, p.name);
                fs.mkdirSync(outDir, { recursive: true });
                fs.writeFileSync(path.join(outDir, att.filename || 'attachment.pdf'), buf);
                console.log(`  Saved ${buf.length} bytes`);
            } catch (err: any) {
                console.log(`  Download failed: ${err.message}`);
            }
            break; // Only first sample
        }
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
