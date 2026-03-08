import '@/loaders/logger';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

const BASE = path.join(process.cwd(), 'output', 'investment-pdfs');

const PAN = 'BWKPD0449P';
const PDFS = [
    { dir: 'zerodha-equity', file: 'weekly-securities-statement_YC3686.pdf', passwords: ['', 'YC3686', PAN, PAN.toLowerCase()] },
    { dir: 'zerodha-demat', file: 'transaction-with-holding-statement_YC3686-1208160005968580.pdf', passwords: ['', 'YC3686', PAN, PAN.toLowerCase(), `YC3686${PAN}`, `${PAN}YC3686`] },
    { dir: 'indmoney', file: 'LDWK_XY04EJR037_Grp1_31032025.PDF', passwords: ['', PAN, PAN.toLowerCase()] },
    { dir: 'bse', file: '8503687287.pdf', passwords: ['', PAN, PAN.toLowerCase()] },
    { dir: 'nsdl-cas', file: 'NSDLe-CAS_112572789_APR_2025.PDF', passwords: ['', PAN, PAN.toLowerCase()] },
    { dir: 'icici-securities', file: 'TRX-Equity_07-04-2025_981042.pdf', passwords: ['', PAN, PAN.toLowerCase()] },
];

async function main() {
    for (const p of PDFS) {
        const filePath = path.join(BASE, p.dir, p.file);
        const buf = fs.readFileSync(filePath);

        console.log(`\n=== ${p.dir}/${p.file} (${buf.length} bytes) ===`);

        for (const pw of p.passwords) {
            try {
                const parser = new PDFParse({
                    data: new Uint8Array(buf),
                    password: pw || undefined,
                });
                const result = await parser.getText();
                await parser.destroy();

                const text = result.text;
                const outFile = path.join(BASE, p.dir, 'extracted.txt');
                fs.writeFileSync(outFile, text);
                console.log(`  OK with password: "${pw || '(none)'}". ${text.length} chars. First 500:`);
                console.log(text.substring(0, 500));
                break;
            } catch (err: any) {
                console.log(`  FAIL with "${pw || '(none)'}": ${err.message?.substring(0, 80)}`);
            }
        }
    }
}

main().catch(err => { console.error(err); process.exit(1); });
