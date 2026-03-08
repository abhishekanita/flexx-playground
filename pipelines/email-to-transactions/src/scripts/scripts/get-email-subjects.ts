// =============================================================================
// Seed script — imports all existing parsers into the parser-configs collection
// =============================================================================
// Run: npm run script -- get-email-subjects.ts

import { rawEmailsService } from '@/services/emails/raw-emails.service';

// =============================================================================

export async function getEmailSubjects() {
    console.log('hey');
    const userId = '69a4500be8ae76d9b62883f2';
    const emails = await rawEmailsService.getAggregatedResults([
        {
            $group: {
                _id: '$fromAddress',
                subjects: {
                    $push: '$subject',
                },
                count: {
                    $sum: 1,
                },
            },
        },
        {
            $sort: {
                count: -1,
            },
        },
    ]);
    console.log(emails, emails.length);
    return;
}

// Run directly
if (require.main === module) {
    require('@/loaders/logger');
    const initServer = require('@/loaders').default;
    initServer().then(async () => {
        await getEmailSubjects();
        process.exit(0);
    });
}
