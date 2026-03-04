import { decodeCurl } from './decode-curl';
import { fetchCamsEmail } from './fetch-cams-email';
import { testStatementGen } from './statement-gen';
import { testDetailedParsing } from './test-detialed-parsing';
import { runAnalysis } from './run-analysis';
import { runBothSyncs } from './run-sync';
import { GrowwScraper } from '@/core/scraper/groww-scraper';
import { DetailedStatementParser } from '@/core/parsing/statement-parser';
import { MFStatementCategory } from '@/types/statements';
import * as fs from 'fs';
import * as path from 'path';

export const runScripts = async () => {
    try {
        console.log('---scripts-started-----');

        // Run sync flow on both parsed datasets
        await runBothSyncs();
        // await testDetailedParsing()


    } catch (err) {
        console.log('error in scripts', err);
    }
};
