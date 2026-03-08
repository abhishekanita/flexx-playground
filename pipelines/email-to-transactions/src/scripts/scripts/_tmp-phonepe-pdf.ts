import '@/loaders/logger';
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');

(async () => {
    const buf = fs.readFileSync('/Users/mack/Desktop/fintech/product/experiments/playground-mono/pipelines/email-to-transactions/PhonePe_Transaction_Statement.pdf');
    const parser = new PDFParse({ data: new Uint8Array(buf), password: '7838237658' });
    const result = await parser.getText();
    await parser.destroy();

    const outDir = path.join(__dirname, '..', '..', '..', 'output', 'phonepe-pdf');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'statement.txt'), result.text);
    console.log('Extracted', result.text.length, 'chars');
    console.log(result.text.substring(0, 2000));
})();
