import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

// Card ending: XX92, Name: ASHUTOSH DHEWAL, DOB: 06/11/1995, Phone: 9810254998
// Filename ref: 0914848356153081
const pwList = [
    // card last 4 (from filename) + DOB combos
    '30810611',
    '308106111995',
    '3081061195',

    // card ending from email (XX92) — but we don't know full last 4
    // Could be 0092, 0192, 0292... let's try common patterns

    // Maybe: name first 4 + card last 4
    'ASHU3081',
    'ashu3081',

    // SBI Card new format 2024: might be DD/MM/YYYY literally
    '06/11/1995',

    // Or first 4 name lowercase + DDMMYY
    'ashu061195',
    'ASHU061195',

    // first 4 name + last 5 phone
    'ashu54998',
    'ASHU54998',

    // DOB DDMM + last 4 card
    '06113081',

    // Reverse: YYYYMMDD
    '19951106',

    // Maybe the account number from filename?
    '0914',
    '09148483',
    '84835615',

    // dhewal combos
    'dhew0611',
    'DHEW0611',
    'dhew061195',
    'DHEW061195',

    // Full name combos
    'ashutosh061195',
    'ASHUTOSH061195',
    'ashutoshdhewal',
    'AshutoshDhewal06',

    // Maybe just the phone number
    '9810254998',
    '09810254998',

    // SBI Card sometimes uses: first letter + last name first 3 + DDMM
    'adhe0611',
    'ADHE0611',

    // Or maybe DOB MMDDYYYY
    '11061995',

    // full phone last 4 + dob ddmm
    '49980611',

    // Ashutosh without vowels
    'shtsh0611',

    // Very common: just DOB in DD-MM-YYYY with hyphens
    '06-11-1995',

    // Or DDMONYYYY
    '06NOV1995',
    '06Nov1995',
    '06nov1995',
];

async function main() {
    await databaseLoader();
    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    const emails = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: 'statements@sbicard.com',
    });

    // Try on first AND a later statement (password format may have changed)
    for (const email of [emails[0], emails[emails.length - 1]]) {
        const att = email.attachments?.[0];
        if (!att) continue;

        console.log(`\n=== Trying: ${att.filename} (${email.subject}) ===`);
        const buf = await gmail.downloadAttachment((email as any).gmailMessageId, att.gmailAttachmentId);

        for (const pw of [...new Set(pwList)]) {
            try {
                const parser = new PDFParse({ data: new Uint8Array(buf), password: pw });
                const result = await parser.getText();
                await parser.destroy();
                console.log(`✓ "${pw}" WORKS! (${result.text.length} chars)`);

                const outDir = path.join(process.cwd(), 'output', 'sbicard');
                fs.mkdirSync(outDir, { recursive: true });
                fs.writeFileSync(path.join(outDir, 'sample.txt'), result.text);
                console.log('First 500 chars:', result.text.substring(0, 500));
                process.exit(0);
            } catch (e) {
                // wrong
            }
        }
        console.log(`None of ${pwList.length} passwords worked`);
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
