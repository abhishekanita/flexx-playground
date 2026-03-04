import mongoose from 'mongoose';
import { config } from '@/config';

class ResetMandates {
    async run() {
        const uri = `${config.db.uri}/${config.db.name}`;

        console.log(`\nConnecting to "${config.db.name}"...`);
        await mongoose.connect(uri);

        // Reset all mandates to pending
        const mandateResult = await mongoose.connection.db!
            .collection('mandates')
            .updateMany({}, { $set: { enrichmentStatus: 'pending', enrichedData: null, lastEnrichmentAttemptAt: null } });

        console.log(`Reset ${mandateResult.modifiedCount} mandates to pending`);

        // Clear all provider configs (will be re-seeded on next server start)
        const configResult = await mongoose.connection.db!
            .collection('mandate_provider_configs')
            .deleteMany({});

        console.log(`Deleted ${configResult.deletedCount} provider configs`);

        await mongoose.disconnect();
        console.log('Done.\n');
    }
}

export default new ResetMandates();
