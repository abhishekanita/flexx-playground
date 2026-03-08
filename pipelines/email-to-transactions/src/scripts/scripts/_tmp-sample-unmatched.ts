import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import * as cheerio from 'cheerio';

const USER_ID = '69ad593fb3726a47dec36515';

const GROUPS = [
    { name: 'nse-balance', from: 'nse_alerts@nse.co.in' },
    { name: 'hdfc-savings', from: 'hdfcbanksmartstatement@hdfcbank.net' },
    { name: 'indigo-invoice', from: '6egstinvoice@goindigo.in' },
    { name: 'nse-trades', from: 'nse-direct@nse.co.in' },
    { name: 'amex-statement', from: 'onlinestatements@welcome.americanexpress.com' },
    { name: 'icici-demat', from: 'customercare@icicibank.com' },
    { name: 'razorpay', from: 'no-reply@razorpay.com' },
    { name: 'apartment', from: 'do-not-reply@rank1infotech.com' },
    { name: 'amazon-confirm', from: 'auto-confirm@amazon.in' },
    { name: 'amazon-ship', from: 'shipment-tracking@amazon.in' },
    { name: 'amazon-deliver', from: 'order-update@amazon.in' },
    { name: 'cred', from: 'protect@cred.club' },
    { name: 'billdesk', from: 'hdfcbankbillpay@billdesk.in' },
    { name: 'hdfc-emi', from: 'termloans.creditcard@hdfcbank.net' },
    { name: 'stripe-x', from: 'invoice+statements+acct_1ika5ja3kz32dpo1@stripe.com' },
    { name: 'anthropic', from: 'invoice+statements@mail.anthropic.com' },
    { name: 'zomato-refund', from: 'noreply@zomato.com' },
    { name: 'swiggy-misc', from: 'noreply@swiggy.in' },
    { name: 'dominos', from: 'do-not-reply@dominos.co.in' },
    { name: 'dividend-apollo', from: 'clientservice@integratedregistry.in' },
    { name: 'dividend-polycab', from: 'kfpl.cs.poly@kfintech.com' },
    { name: 'dividend-trent', from: 'trentltd.dividend@in.mpms.mufg.com' },
    { name: 'sbi-interest', from: 'cbssbi.info@alerts.sbi.co.in' },
    { name: 'itr', from: 'intimations@cpc.incometax.gov.in' },
    { name: 'itr-confirm', from: 'communication@cpc.incometax.gov.in' },
    { name: 'zomato-dineout', from: 'dining@zomato.com' },
    { name: 'hdfc-alerts-unmatched', from: 'alerts@hdfcbank.net', subjectExclude: /account update|UPI txn|Credit Card|debited via/i },
];

async function main() {
    await databaseLoader();

    for (const g of GROUPS) {
        const emails = await rawEmailsService.find({ userId: USER_ID, fromAddress: g.from });
        let filtered = emails;
        if ((g as any).subjectExclude) {
            filtered = emails.filter(e => !(g as any).subjectExclude.test(e.subject || ''));
        }

        console.log(`\n========== ${g.name} (${filtered.length}x from ${g.from}) ==========`);

        // Show first 2 samples
        for (const e of filtered.slice(0, 2)) {
            console.log(`\n--- Subject: ${e.subject} ---`);
            console.log(`Date: ${e.receivedAt}`);
            console.log(`Attachments: ${e.attachments?.map((a: any) => `${a.filename} (${a.mimeType})`).join(', ') || 'none'}`);

            // Extract text
            if (e.bodyHtml) {
                const $ = cheerio.load(e.bodyHtml);
                const text = $.root().text().replace(/\s+/g, ' ').trim();
                console.log(`Body (${text.length} chars): ${text.substring(0, 400)}`);
            } else if (e.bodyText) {
                console.log(`BodyText (${e.bodyText.length} chars): ${e.bodyText.substring(0, 400)}`);
            } else {
                console.log('No body content');
            }
        }
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
