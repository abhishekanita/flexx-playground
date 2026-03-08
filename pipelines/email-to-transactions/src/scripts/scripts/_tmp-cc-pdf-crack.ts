import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

// Ashutosh Dhewal, DOB: 06/11/1995, Phone: 9810254998
const PASSWORDS = [
    // DOB variants
    '06111995',   // DDMMYYYY
    '06/11/1995', // DD/MM/YYYY
    '06-11-1995', // DD-MM-YYYY
    '0611',       // DDMM
    '061195',     // DDMMYY
    '19951106',   // YYYYMMDD
    '1106',       // MMDD
    '11061995',   // MMDDYYYY
    '110695',     // MMDDYY
    '1995',       // YYYY

    // Name + DOB combos
    'ashu0611',   // first4 + DDMM
    'ASHU0611',
    'ashu06111995', // first4 + DDMMYYYY
    'ASHU06111995',
    'ashutosh0611',
    'ASHUTOSH0611',
    'ash0611',    // first3 + DDMM
    'ASH0611',
    'ASHU1106',   // first4 + MMDD
    'ashu1106',
    'ASH1106',
    'dhe0611',    // last name first3 + DDMM
    'DHE0611',
    'dhew0611',   // last name first4 + DDMM
    'DHEW0611',
    'adhe0611',   // initial + last3 + DDMM
    'ADHE0611',

    // Phone variants
    '9810254998',
    '54998',      // last 5
    '4998',       // last 4

    // Name + phone combos
    'ashu54998',
    'ASHU54998',

    // SBI Card specific (card ending XX92)
    // Common: DOB DDMMYYYY
    // Sometimes: last 4 of card + DOB

    // HDFC specific patterns
    // Common: first 3 caps + DOB DDMM
    'ASH0611',
    'ASH06111995',
    'ASHUTOSH',
    'ashutosh',
    'dhewal',
    'DHEWAL',

    // PAN-based (common for HDFC)
    // Don't have PAN, skip

    // Just name
    'ashutosh',
    'ASHUTOSH',
    'Ashutosh',
];

// Deduplicate
const uniquePasswords = [...new Set(PASSWORDS)];

async function tryPasswords(buf: Buffer, label: string): Promise<string | null> {
    for (const pw of uniquePasswords) {
        try {
            const parser = new PDFParse({ data: new Uint8Array(buf), password: pw });
            const result = await parser.getText();
            await parser.destroy();
            console.log(`  ✓ "${pw}" WORKS! (${result.text.length} chars extracted)`);

            const outDir = path.join(process.cwd(), 'output', label);
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.join(outDir, `sample-${pw}.txt`), result.text);
            console.log(`  Saved to output/${label}/sample-${pw}.txt`);
            return pw;
        } catch (e: any) {
            // silent - wrong password
        }
    }
    console.log(`  ✗ None of ${uniquePasswords.length} passwords worked`);
    return null;
}

async function main() {
    await databaseLoader();
    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    // 1. SBI Card statement
    console.log('=== SBI Card PDF ===');
    const sbiCards = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: 'statements@sbicard.com',
    });
    if (sbiCards.length > 0) {
        const email = sbiCards[0];
        const att = email.attachments?.[0];
        if (att) {
            console.log(`Downloading: ${att.filename}`);
            const buf = await gmail.downloadAttachment((email as any).gmailMessageId, att.gmailAttachmentId);
            const pw = await tryPasswords(buf, 'sbicard');
            if (!pw) {
                console.log('  Trying empty password...');
                try {
                    const parser = new PDFParse({ data: new Uint8Array(buf) });
                    const result = await parser.getText();
                    await parser.destroy();
                    console.log('  Empty password works!');
                } catch (e) {
                    console.log('  Empty password also failed');
                }
            }
        }
    }

    // 2. HDFC CC statement
    console.log('\n=== HDFC CC PDF ===');
    const hdfcCards = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: { $regex: 'emailstatements.*hdfcbank', $options: 'i' },
        subject: { $regex: 'credit card statement', $options: 'i' },
    });
    if (hdfcCards.length > 0) {
        // Pick one with actual PDF mime type
        const email = hdfcCards.find((e: any) => e.attachments?.some((a: any) => a.mimeType === 'application/pdf'))
            || hdfcCards[0];
        const att = email.attachments?.[0];
        if (att) {
            console.log(`Downloading: ${att.filename} (from ${email.subject})`);
            const buf = await gmail.downloadAttachment((email as any).gmailMessageId, att.gmailAttachmentId);
            const pw = await tryPasswords(buf, 'hdfc-cc');
        }
    }

    // 3. HDFC savings account statement (body-based, no PDF)
    console.log('\n=== HDFC Savings Statement (body text) ===');
    const hdfcSavings = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: 'hdfcbanksmartstatement@hdfcbank.net',
    });
    if (hdfcSavings.length > 0) {
        const email = hdfcSavings[0];
        console.log(`Subject: ${email.subject}`);
        console.log(`Has body text: ${!!email.bodyText} (${email.bodyText?.length} chars)`);
        console.log(`Has body html: ${!!email.bodyHtml} (${email.bodyHtml?.length} chars)`);

        const outDir = path.join(process.cwd(), 'output', 'hdfc-savings');
        fs.mkdirSync(outDir, { recursive: true });

        if (email.bodyText) {
            fs.writeFileSync(path.join(outDir, 'sample-body.txt'), email.bodyText);
            console.log('Saved body text');
            console.log('First 1000 chars:', email.bodyText.substring(0, 1000));
        }
        if (email.bodyHtml) {
            fs.writeFileSync(path.join(outDir, 'sample-body.html'), email.bodyHtml);
            console.log('Saved body html');
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
