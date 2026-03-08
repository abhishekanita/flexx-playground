import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';

async function main() {
    await databaseLoader();
    const mongoose = require('mongoose');
    const coll = mongoose.connection.db.collection('raw-data.emails-v2');

    const USER_ID = '69ad593fb3726a47dec36515';

    // Check distinct createdAt times to understand how many sync runs happened
    const pipeline = [
        { $match: { userId: USER_ID } },
        { $group: {
            _id: {
                // Group by minute to see sync batches
                $dateToString: { format: '%Y-%m-%dT%H:%M', date: '$createdAt' }
            },
            count: { $sum: 1 },
            minReceivedAt: { $min: '$receivedAt' },
            maxReceivedAt: { $max: '$receivedAt' },
        }},
        { $sort: { _id: 1 } },
    ];
    const batches = await coll.aggregate(pipeline).toArray();
    console.log('=== Sync batches (by createdAt minute) ===');
    for (const b of batches) {
        console.log(`${b._id}: ${b.count} emails (receivedAt range: ${b.minReceivedAt} → ${b.maxReceivedAt})`);
    }

    // Check the user's sync cursor history
    const userColl = mongoose.connection.db.collection('users');
    const user = await userColl.findOne({ _id: new mongoose.Types.ObjectId(USER_ID) });
    console.log('\n=== User sync cursor ===');
    console.log('gmailSyncCursor:', user?.gmailSyncCursor);
    console.log('user keys:', Object.keys(user || {}));

    // Check total count per receivedAt month
    const monthlyRecv = await coll.aggregate([
        { $match: { userId: USER_ID } },
        { $addFields: { rd: { $dateFromString: { dateString: '$receivedAt' } } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$rd' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]).toArray();
    console.log('\n=== Emails by receivedAt month ===');
    for (const m of monthlyRecv) {
        console.log(`${m._id}: ${m.count}`);
    }

    // Check the last few emails by createdAt to see where sync stopped
    const lastEmails = await coll.find({ userId: USER_ID })
        .sort({ createdAt: -1 })
        .limit(5)
        .project({ subject: 1, fromAddress: 1, receivedAt: 1, createdAt: 1, fetchedAt: 1 })
        .toArray();
    console.log('\n=== Last 5 emails inserted (by createdAt) ===');
    for (const e of lastEmails) {
        console.log(JSON.stringify(e));
    }

    // Check first emails too
    const firstEmails = await coll.find({ userId: USER_ID })
        .sort({ createdAt: 1 })
        .limit(5)
        .project({ subject: 1, fromAddress: 1, receivedAt: 1, createdAt: 1, fetchedAt: 1 })
        .toArray();
    console.log('\n=== First 5 emails inserted (by createdAt) ===');
    for (const e of firstEmails) {
        console.log(JSON.stringify(e));
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
