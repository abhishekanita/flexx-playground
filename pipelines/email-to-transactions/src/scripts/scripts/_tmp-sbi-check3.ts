import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    // Total emails for this user
    const mongoose = require('mongoose');
    const coll = mongoose.connection.db.collection('raw-data.emails-v2');
    const total = await coll.countDocuments({ userId: USER_ID });
    console.log('Total emails in DB for user:', total);

    // Check the 2 SBI statement emails that ARE in the DB
    const statements = await rawEmailsService.find({
        userId: USER_ID,
        subject: { $regex: 'E-account statement.*SBI', $options: 'i' },
    });
    console.log('\n=== SBI Statements in DB ===');
    for (const e of statements) {
        console.log(JSON.stringify({
            id: (e as any)._id?.toString(),
            gmailMessageId: (e as any).gmailMessageId,
            subject: e.subject,
            from: e.fromAddress,
            date: e.receivedAt,
            fetchedAt: (e as any).fetchedAt,
            createdAt: (e as any).createdAt,
            status: e.status,
            contenthash: (e as any).contenthash,
        }));
    }

    // Check oldest and newest emails per month to understand sync coverage
    const pipeline = [
        { $match: { userId: USER_ID } },
        { $addFields: { receivedDate: { $dateFromString: { dateString: '$receivedAt' } } } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$receivedDate' } },
            count: { $sum: 1 },
            earliest: { $min: '$receivedDate' },
            latest: { $max: '$receivedDate' },
        }},
        { $sort: { _id: 1 } },
    ];
    const monthly = await coll.aggregate(pipeline).toArray();
    console.log('\n=== Monthly email distribution ===');
    for (const m of monthly) {
        console.log(`${m._id}: ${m.count} emails`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
