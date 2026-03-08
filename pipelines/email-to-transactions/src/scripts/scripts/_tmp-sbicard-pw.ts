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

    // Get the SBI Card statement email and dump full HTML body for password hint
    const emails = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: 'statements@sbicard.com',
    });

    if (emails.length === 0) {
        console.log('No SBI Card statement emails found');
        process.exit(0);
    }

    // Check ALL statement emails for password hints in body
    for (const email of emails.slice(0, 3)) {
        console.log(`\n=== ${email.subject} ===`);
        const html = email.bodyHtml || '';
        // Strip HTML but keep structure
        const text = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?(p|div|tr|td|th|li|h\d)[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        console.log(text);
    }

    // Now try more SBI Card specific passwords
    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    const email = emails[0];
    const att = email.attachments?.[0];
    if (!att) {
        console.log('No attachment');
        process.exit(0);
    }

    const buf = await gmail.downloadAttachment((email as any).gmailMessageId, att.gmailAttachmentId);

    // SBI Card password patterns:
    // Common: DDMMYYYY, card number based, name-based
    // The email mentions "change in password configuration"
    // New SBI Card pattern is often: First 4 chars of name (lower) + DDMM of DOB
    // Or: Card number last 4 + DOB DDMM
    // Or: DDMMYYYY of DOB
    // Or: First 4 name + last 4 card
    const morePws = [
        // Card number from filename: 0914848356153081 — last 4 = 3081
        '3081',
        '30810611',
        '06113081',
        'ashu3081',
        'ASHU3081',

        // Full card number combos
        '153081',
        '56153081',

        // SBI specific: name (lowercase) + DDMM
        'ashutosh0611',
        'ashutoshdhewal',
        'AshutoshDhewal',

        // SBI Card specific: DDMMYYYY (already tried)
        // Try: YYYYMMDD
        '19951106',

        // Try: name caps + DDMMYYYY
        'ASHU06111995',

        // Phone-based
        '9810254998',
        '254998',
        '54998',

        // Mix: last4phone + DOB
        '499806111995',
        '4998',

        // Customer ID based? filename starts with 0914848356153081
        '0914',
        '8483',
        '5615',

        // All-numeric combos
        '06119810254998',

        // Common SBI Card: last 8 of card number
        '56153081',

        // Name without vowels + DOB
        'shts0611',

        // Possible: DD/MM/YYYY
        '06/11/1995',

        // PAN format: 5 letters + 4 digits + 1 letter (don't have it)

        // Try just the DOB in various formats one more time
        'Nov061995',
        '06Nov1995',
        '6111995',
        '611995',
        '06111995',  // duplicate but making sure

        // SBI new pattern mentioned in email: could be
        // First 4 of name (caps) + Last 4 of card number
        'ASHU3081',
        'ashu3081',
        'DHEW3081',

        // Or DOB DD-MM-YYYY
        '06-11-1995',

        // SBI Card 2024+ pattern: ddmmyyyy (DOB)
        '06111995',

        // Card number (last 4) + DOB DDMMYYYY
        '308106111995',
    ];

    const uniquePws = [...new Set(morePws)];
    console.log(`\n=== Trying ${uniquePws.length} more passwords on SBI Card PDF ===`);

    for (const pw of uniquePws) {
        try {
            const parser = new PDFParse({ data: new Uint8Array(buf), password: pw });
            const result = await parser.getText();
            await parser.destroy();
            console.log(`✓ "${pw}" WORKS! (${result.text.length} chars)`);

            const outDir = path.join(process.cwd(), 'output', 'sbicard');
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.join(outDir, `sample-${pw}.txt`), result.text);
            process.exit(0);
        } catch (e) {
            // wrong password
        }
    }
    console.log('Still no luck. Check the email body above for the password pattern.');

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
