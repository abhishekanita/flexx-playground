import { gmailPlugin } from '@/plugins/google/gmail.plugin';
import { gmailAuthService } from '@/services/gmail/gmail-auth.service';
import unzipper from 'unzipper';

const mailbackSubjects = [
    'Consolidated Account Statement - CAMS Mailback Request',
    'Consolidated Statement on IDCW - CAMS Mailback Request',
    'ELSS One View Statement - CAMS Mailback Request',
    'Consolidated Pay-In and Pay-Out Statement - CAMS Mailback Request',
    'Transaction Statement - CAMS Mailback Request',
    ' Consolidated Capital Gain / Loss Statement – CAMS Mailback Request',
    'ActiveStatement - CAMS Mailback Request',
    'Consolidated Portfolio Statement - CAMS Mailback Request',
];

const subjects = [
    'Statement of Financial Transactions',
    'Consolidated Statement – Grand-Fathered Equity Oriented Schemes',
    'Change in Fundamental Attributes of ICICI Prudential Bluechip Fund',
    'Total Expense Ratio (TER) of ICICI Prudential Bluechip Fund - Direct Plan - Growth',
    'Change in Total Expense Ratio of Scheme(s) of Aditya Birla Sun Life Mutual Fund',
    'Total Expense Ratio (TER) of ICICI Prudential Commodities Fund Direct Plan Growth',
    'Change in Fundamental Attributes of ICICI Prudential Commodities Fund',
    'Total Expense Ratio (TER) of ICICI Prudential Technology Fund - Direct Plan -  Growth',
    'Survey Regarding efficacy of Risk-o-Meter – Important',
    'Risk-O-meter Survey',
];

export const fetchCamsEmail = async () => {
    try {
        const email = 'abhishek12318@gmail.com';
        const searchQuery = 'from:donotreply@camsonline.com';

        const gmail = await gmailAuthService.getGmailClient(email);

        const messageIds = await gmailPlugin.fetchMessageIds(gmail, searchQuery, 100);
        if (messageIds.length === 0) {
            console.log('No message found for query:', searchQuery);
            return;
        }

        const messages = await gmailPlugin.fetchMessages(gmail, messageIds);

        const message = messages?.find(i => i.subject?.includes('Consolidated Portfolio Statement'));
        if (!message) {
            console.log('No Consolidated Portfolio Statement email found');
            return;
        }

        const zipAttachments = message.attachments.filter(a => a.filename.endsWith('.zip'));
        if (zipAttachments.length === 0) {
            console.log('No zip attachments found');
            return;
        }

        const allJsonData: any[] = [];
        const zipPassword = '12345678@';

        for (const att of zipAttachments) {
            const buffer = await gmailPlugin.fetchAttachmentData(gmail, message.id, att.attachmentId);
            const directory = await unzipper.Open.buffer(buffer);

            for (const file of directory.files) {
                if (file.path.endsWith('.json') && file.type === 'File') {
                    const content = await file.buffer(zipPassword);
                    const parsed = JSON.parse(content.toString('utf-8'));
                    allJsonData.push(parsed);
                }
            }
        }

        console.log(`Found ${allJsonData.length} JSON file(s) in zip`);
        console.log(JSON.stringify(allJsonData, null, 2));
    } catch (err) {
        console.log(err);
    }
};
