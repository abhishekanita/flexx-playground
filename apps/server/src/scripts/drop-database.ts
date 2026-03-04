import mongoose from 'mongoose';
import { config } from '@/config';

class DropDatabase {
    async run(dbName?: string) {
        const targetDb = dbName || config.db.name;
        const uri = `${config.db.uri}/${targetDb}`;

        console.log(`\n⚠️  WARNING: About to drop database "${targetDb}"`);
        console.log(`URI: ${config.db.uri}`);
        console.log(`\nConnecting...`);

        await mongoose.connect(uri);
        console.log(`Connected to "${targetDb}"`);

        await mongoose.connection.db!.dropDatabase();
        console.log(`✅ Database "${targetDb}" has been dropped.`);

        await mongoose.disconnect();
        console.log('Disconnected.\n');
    }
}

export default new DropDatabase();
