import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

// DOB: 06/11/1995, Card last 4: 4835
const pwList = [
    '061119954835',
    '483506111995',
    '4835061195',
    '061195 4835',
    '48350611',
    '06114835',
    '483561195',
];

async function main() {
    await databaseLoader();
    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    const emails = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: 'statements@sbicard.com',
    });

    const email = emails[0];
    const att = email.attachments?.[0];
    if (!att) { console.log('No attachment'); process.exit(1); }

    const buf = await gmail.downloadAttachment((email as any).gmailMessageId, att.gmailAttachmentId);

    for (const pw of pwList) {
        try {
            const parser = new PDFParse({ data: new Uint8Array(buf), password: pw });
            const result = await parser.getText();
            await parser.destroy();
            console.log(`✓ "${pw}" WORKS! (${result.text.length} chars)`);

            const outDir = path.join(process.cwd(), 'output', 'sbicard');
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.join(outDir, 'sample.txt'), result.text);
            console.log('First 1000 chars:');
            console.log(result.text.substring(0, 1000));
            process.exit(0);
        } catch (e) {
            console.log(`  ✗ "${pw}"`);
        }
    }
    console.log('None worked');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
