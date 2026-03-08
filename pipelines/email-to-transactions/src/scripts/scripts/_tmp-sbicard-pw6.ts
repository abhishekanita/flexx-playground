import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';
const PASSWORD = '061119954835';

async function main() {
    await databaseLoader();
    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    const emails = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: 'statements@sbicard.com',
    });

    console.log(`Found ${emails.length} SBI Card emails\n`);

    const outDir = path.join(process.cwd(), 'output', 'sbicard');
    fs.mkdirSync(outDir, { recursive: true });

    for (const email of emails) {
        const att = email.attachments?.[0];
        if (!att) { console.log(`${email.subject}: No attachment`); continue; }

        console.log(`--- ${email.subject} ---`);
        console.log(`  Attachment: ${att.filename} (${att.mimeType})`);

        try {
            const buf = await gmail.downloadAttachment((email as any).gmailMessageId, att.gmailAttachmentId);
            console.log(`  Downloaded: ${buf.length} bytes`);

            // Try with password
            try {
                const parser = new PDFParse({ data: new Uint8Array(buf), password: PASSWORD });
                const result = await parser.getText();
                await parser.destroy();
                console.log(`  ✓ Password "${PASSWORD}" WORKS! (${result.text.length} chars)`);

                const safeName = email.subject.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 60);
                fs.writeFileSync(path.join(outDir, `${safeName}.txt`), result.text);
            } catch (e: any) {
                console.log(`  ✗ Password failed: ${e.message?.substring(0, 100)}`);

                // Try without password
                try {
                    const parser2 = new PDFParse({ data: new Uint8Array(buf) });
                    const result2 = await parser2.getText();
                    await parser2.destroy();
                    console.log(`  ✓ No password needed! (${result2.text.length} chars)`);
                } catch (e2: any) {
                    console.log(`  ✗ No password also fails: ${e2.message?.substring(0, 100)}`);
                }
            }
        } catch (e: any) {
            console.log(`  ✗ Download failed: ${e.message?.substring(0, 100)}`);
        }
        console.log();
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
