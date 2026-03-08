import * as fs from 'fs';
import * as path from 'path';
import { DeclarativeEngine } from '@/pipelines/parsers/helpers/declarative-engine';
import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';
import { parseLiciousOrderEmail } from '@/pipelines/parsers/providers/invoices/licious-order.parser';

const engine = new DeclarativeEngine();
const samplesBase = path.join(process.cwd(), 'output', 'provider-samples');

// Declarative parsers
const DECLARATIVE_TESTS = [
    { slug: 'zomato_order', dir: 'zomato', file: 'sample.html' },
    { slug: 'hdfc_upi_alert', dir: 'hdfc-alerts', file: 'sample2.html' },
    { slug: 'rapido_ride', dir: 'rapido', file: 'sample.html' },
    { slug: 'google_play_receipt', dir: 'google-play', file: 'sample.html' },
    { slug: 'apartment_maintenance', dir: 'apartment', file: 'sample.html' },
];

for (const test of DECLARATIVE_TESTS) {
    const config = PARSER_CONFIGS.find(c => c.slug === test.slug);
    if (!config || config.strategy !== 'declarative' || !config.declarativeRules) {
        console.log(`\n=== ${test.slug} === CONFIG NOT FOUND OR NOT DECLARATIVE`);
        continue;
    }

    const filePath = path.join(samplesBase, test.dir, test.file);
    if (!fs.existsSync(filePath)) {
        console.log(`\n=== ${test.slug} === FILE NOT FOUND: ${filePath}`);
        continue;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const result = engine.runParser(html, config.declarativeRules);
    console.log(`\n=== ${test.slug} ===`);
    console.log(JSON.stringify(result, null, 2));
}

// Code parsers
console.log('\n=== licious_order ===');
const liciousHtml = fs.readFileSync(path.join(samplesBase, 'licious', 'sample.html'), 'utf-8');
console.log(JSON.stringify(parseLiciousOrderEmail(liciousHtml), null, 2));
