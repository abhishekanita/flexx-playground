# Email-to-Transactions Pipeline

## Project structure
- `src/pipelines/email-sync/` — Stage 1: Gmail sync (fetch emails → MongoDB)
- `src/pipelines/parsers/` — Stage 2: Match emails to parsers, extract structured data
- `src/pipelines/parsers/providers/` — Individual parser implementations (kotak, sbi, etc.)
- `src/pipelines/parsers/provider-configs.ts` — Registry mapping emails → parsers
- `src/types/` — Domain types (transactions, investments, loans, insurance)
- `src/scripts/` — Entry points for running pipeline stages

## Running code
```bash
# Run via ts-node with path aliases
npx ts-node --files -r tsconfig-paths/register -e "<inline code>"

# Run the full pipeline
npm run dev
```

## Key conventions
- Logger is a global (`logger.info/warn/error`) — initialized by `src/loaders/logger.ts`
- Database must be connected before queries — use `require('./src/loaders/logger'); await databaseLoader();`
- PDF parsing uses pdf-parse v2: `new PDFParse({ data: new Uint8Array(buffer), password })` → `.getText()` → `.destroy()`
- Parsers return plain objects (not DB documents) — no mongoose dependency in parser files
- Provider configs use fromAddress (string or RegExp) + subject (string or RegExp) for matching

## Skills

### /create-provider
Create a new provider config and parser for a specific email type (bank statement, transaction alert, etc.).

#### Workflow

**Step 1: Identify the provider**
Ask the user which provider/email type they want to parse (e.g. "HDFC credit card statement", "Axis bank debit alert").

**Step 2: Find sample emails in the database**
Run a DB query to find emails matching the provider. Search by sender domain or subject keywords:

```typescript
require('./src/loaders/logger');
const { databaseLoader } = require('./src/loaders/database');
const { rawEmailsService } = require('./src/services/emails/emails.service');

(async () => {
    await databaseLoader();
    // Search by sender domain or subject
    const emails = await rawEmailsService.find({
        fromAddress: { $regex: '<sender_pattern>', $options: 'i' }
    });
    for (const e of emails) {
        console.log(JSON.stringify({
            id: e._id,
            subject: e.subject,
            from: e.fromAddress,
            date: e.receivedAt,
            hasPdf: e.hasPdf,
            hasAttachments: e.hasAttachments,
            attCount: e.attachments?.length,
            attachments: e.attachments?.map(a => ({ name: a.filename, mime: a.mimeType })),
            bodyTextLength: e.bodyText?.length,
            status: e.status,
        }));
    }
    process.exit(0);
})();
```

Show the user what was found. If no emails exist, tell them to run email sync first.

**Step 3: Extract raw content**
Based on the email type, extract the parseable content:

- **PDF attachment**: Download via Gmail API and extract text. Write the raw text to `output/<provider>/` for inspection.
- **Email body (HTML/text)**: Read `bodyText` or `bodyHtml` directly from the DB document.

For PDF extraction:
```typescript
require('./src/loaders/logger');
const { databaseLoader } = require('./src/loaders/database');
const { rawEmailsService } = require('./src/services/emails/emails.service');
const { gmailConnectionService } = require('./src/services/users/gmail-connection.service');
const { GmailPlugin } = require('./src/plugins/gmail.plugin');
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const USER_ID = '<user_id>';
const EMAIL_ID = '<email_id>';
const PASSWORDS = ['<try_these>'];

(async () => {
    await databaseLoader();
    const email = await rawEmailsService.findById(EMAIL_ID);
    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    const att = email.attachments[0]; // pick the right one
    const buf = await gmail.downloadAttachment(email.gmailMessageId, att.gmailAttachmentId);

    for (const pw of PASSWORDS) {
        try {
            const parser = new PDFParse({ data: new Uint8Array(buf), password: pw || undefined });
            const result = await parser.getText();
            await parser.destroy();

            const outDir = path.join(__dirname, 'output', '<provider>');
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.join(outDir, 'sample.txt'), result.text);
            console.log('Extracted', result.text.length, 'chars with password:', pw || '(none)');
            break;
        } catch (e) { console.log('Failed with:', pw, e.message); }
    }
    process.exit(0);
})();
```

For body-text emails, just dump `email.bodyText` to a file for analysis.

Show the user the extracted text (read the output file). Ask them to confirm if it looks right, or try different passwords.

**Step 4: Analyze the format**
Read through the extracted text carefully. Identify:
- Header fields (account number, name, dates, branch info)
- Transaction table format (columns, delimiters, date format)
- Multi-page handling (page headers/footers that repeat)
- Opening/closing balance lines
- Any edge cases (multi-line descriptions, continuation pages, footnotes)

Document the format findings before writing code.

**Step 5: Write the parser**
Create the parser file at `src/pipelines/parsers/providers/<provider>-<type>.parser.ts`.

Rules:
- Export interfaces for the parsed output types (e.g. `XyzTransaction`, `XyzStatement`)
- Export a single parse function (e.g. `parseXyzStatement(text: string): XyzStatement`)
- No external dependencies — pure string parsing only
- Handle multi-page content (page breaks, repeated headers)
- Use regex for structured line matching, not positional parsing
- Parse amounts correctly (handle commas, negative signs, Indian notation)
- Convert dates to YYYY-MM-DD format

**Step 6: Test the parser**
Run the parser against ALL available sample files and verify:

```typescript
require('./src/loaders/logger');
const fs = require('fs');
const { parse<Provider> } = require('./src/pipelines/parsers/providers/<file>');

const files = fs.readdirSync('output/<provider>').filter(f => f.endsWith('.txt'));
for (const file of files) {
    const text = fs.readFileSync('output/<provider>/' + file, 'utf-8');
    const result = parse<Provider>(text);
    // Log summary: account info, transaction count, balances
    console.log('===', file, '===');
    // ... log relevant fields
}
```

Then run a **balance continuity check** — for each transaction, verify:
```
expected_balance = previous_balance + credit - debit
actual_balance == expected_balance (within 0.01 tolerance)
```

Report any mismatches. If there are errors, fix the parser and re-test until 0 errors.

**Step 7: Register the provider config**
Add an entry to `PROVIDER_CONFIGS` in `src/pipelines/parsers/provider-configs.ts`:

```typescript
{
    id: '<provider>_<type>',
    name: '<Human readable name>',
    filter: {
        fromAddress: '<exact or regex>',
        subject: /<pattern>/i,  // optional
    },
    pdf: {  // only if PDF-based
        pickAttachment: att => att.mimeType === 'application/pdf' || att.filename?.endsWith('.pdf'),
        passwords: ['<passwords>'],
    },
    parse: text => parse<Provider>(text),
},
```

For body-text parsers (no PDF), omit the `pdf` field and adjust the `ProviderConfig` interface if needed.

**Step 8: Write sample output**
Write one parsed JSON to `output/<provider>/` so the user can inspect the full structured output.

#### Important
- Always test against multiple samples when available — edge cases hide in different months/formats
- Balance check is mandatory — if balances don't add up, the parser has a bug
- Keep parsers simple — regex per line, not complex state machines
- Don't map parsed data to core Transaction/Investment types — that's a separate stage
