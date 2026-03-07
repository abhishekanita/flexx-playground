// import { ParserConfig } from '@/types/parser.type';

// export const kotalBankDebitAlert = {
//     _id: 'abc123',
//     parser_id: 'kotak_bank_statement',
//     version: 2,
//     is_active: true,
//     description: 'Kotal Monthly Bank Statememt',
//     created_by: 'manual',
//     reviewed_by_human: true,
//     created_at: '2026-01-01T00:00:00Z',
//     updated_at: '2026-02-15T00:00:00Z',
//     // ── FILTER ──────────────────────────────────────────────────────────────────
//     filter: {
//         sender: {
//             addresses: ['bankstatements@kotak.bank.in'],
//         },
//         subject: {
//             pattern: 'Your /--add-placeholder/ statement for Kotak A/c //-add placeholdr-//',
//         },
//         hasAttachment: true,
//     },

//     // ── PRE-PROCESS ─────────────────────────────────────────────────────────────
//     preprocess: {
//         strip_html: true,
//         normalize_whitespace: true,
//         replace: [
//             // HDFC sometimes sends 'Rs.' with a non-breaking space
//             { find: 'Rs\u00a0', replace: 'Rs. ', is_regex: false },
//         ],
//         downloadAttachments: true,
//     },

//     async parseMessage(text: string, attachments){

//     }

//     async parsePDF(attachement: Buffer) {
//         const password = '';
//         const pdfBuffer = [];
//         const pdfText = '';
//         const parsedData = [];
//         return parsedData;
//     },
// };

// const stats = {
//     total_matched: 14823,
//     total_parsed: 14691,
//     total_parse_failed: 132,
//     total_inserted: 14620,
//     total_insert_failed: 71,
//     total_skipped: 0,
//     recent_matched: 312,
//     recent_parsed: 309,
//     recent_failed: 3,
//     parse_success_rate: 0.991,
//     insert_success_rate: 0.995,
//     field_capture_rates: {
//         amount: 0.999,
//         tx_type_raw: 0.999,
//         account_last4: 0.997,
//         upi_ref: 0.783, // not all HDFC alerts include UPI ref
//         balance_after: 0.921,
//         tx_date_raw: 0.999,
//         payee: 0.834,
//     },
//     last_matched_at: '2026-03-06T09:14:22Z',
//     last_failed_at: '2026-03-05T22:01:11Z',
//     last_failure_reason: 'Date parse failed: unexpected format "Mar 6, 2026 9:00 AM IST"',
//     top_errors: [
//         { message: 'Date parse failed: unexpected format', count: 89 },
//         { message: 'amount: no regex match found', count: 31 },
//         { message: 'Confidence below threshold: 0.76', count: 12 },
//     ],
// };
