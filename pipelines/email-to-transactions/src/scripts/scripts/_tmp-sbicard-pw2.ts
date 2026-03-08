import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

// Phone: 9810254998, DOB: 06/11/1995
// Last 5 of phone: 54998, DOB DDMMYY: 061195

const pwList = [
    '54998061195',   // last5 + DDMMYY
    '06119554998',   // DDMMYY + last5
    '5499806111995', // last5 + DDMMYYYY
    '0611199554998', // DDMMYYYY + last5
    '4998061195',    // last4phone + DDMMYY
    '06119549980',   // DDMMYY + last5 (with trailing 0?)
    '549980611',     // last5 + DDMM
    '061154998',     // DDMM + last5
    '54998061195',   // last5phone + DDMMYY (primary guess)
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
    console.log(`Downloaded ${buf.length} bytes: ${att.filename}`);

    for (const pw of [...new Set(pwList)]) {
        try {
            const parser = new PDFParse({ data: new Uint8Array(buf), password: pw });
            const result = await parser.getText();
            await parser.destroy();
            console.log(`✓ "${pw}" WORKS! (${result.text.length} chars)`);

            const outDir = path.join(process.cwd(), 'output', 'sbicard');
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.join(outDir, 'sample.txt'), result.text);
            console.log(`Saved to output/sbicard/sample.txt`);
            console.log('\nFirst 1000 chars:');
            console.log(result.text.substring(0, 1000));
            process.exit(0);
        } catch (e) {
            console.log(`  ✗ "${pw}"`);
        }
    }
    console.log('\nNone worked');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
