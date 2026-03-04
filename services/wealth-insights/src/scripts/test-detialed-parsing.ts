import { DetailedStatementParser } from '@/core/parsing/statement-parser';
import fs from 'fs';

export const testDetailedParsing = async () => {
    try {
        const parser = new DetailedStatementParser();
        const path = './CAS_01012019-03032026_CP205929740_03032026112135235.pdf';
        const pdfBuffer = fs.readFileSync(path);
        const data = await parser.parse(pdfBuffer, '12345678@');
        console.log(JSON.stringify(data, null, 2));
        fs.writeFileSync('./parsed.json', JSON.stringify(data, null, 2));
    } catch (err) {
        console.log(err);
    }
};
