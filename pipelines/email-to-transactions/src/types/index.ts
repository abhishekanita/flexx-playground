import { databaseLoader } from '@/loaders/database';
import { runScripts } from '@/scripts';

const main = async () => {
    try {
        await databaseLoader();
        await runScripts();
    } catch (err) {
        console.log(err);
    }
};

main();
