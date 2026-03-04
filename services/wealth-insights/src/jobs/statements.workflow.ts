import { FetchReport } from '@/core/parsing/fetch-report';
import { CAMSBrowserClient } from '@/core/generator/cams.client';
import { IMFStatementsRequestsDoc } from '@/schema';
import { statementRequestsService } from '@/services/requests/statement-requests.service';
import { syncService } from '@/services/user/sync.service';
import { MFStatementCategory, MFStatementsRequests } from '@/types/statements';
import { sleep } from '@/utils/sleept';
import { DetailedStatementParser } from '@/core/parsing/statement-parser';
import { DEFAULT_PASSWORD } from '@/core/generator/helpers/configs';
import logger from '@/utils/logger';

// Email fetch retry config — 30 min total
const EMAIL_MAX_RETRIES = 20;
const EMAIL_INTERVALS = [
    ...Array(5).fill(30_000),   // first 5: 30s each = 2.5 min
    ...Array(5).fill(60_000),   // next 5: 60s each = 5 min
    ...Array(10).fill(120_000), // last 10: 120s each = 20 min
];                               // total: ~27.5 min

const log = logger.createServiceLogger('Workflow');

export class StatementWorkflow {
    constructor() {}

    async restart(requestId: string) {
        const request = await statementRequestsService.getRequestById(requestId);
        if (!request) throw new Error(`Request ${requestId} not found`);
        log.info(`Restarting workflow for ${requestId} (email: ${request.email})`);
        return await this.fetchReports(request);
    }

    async start(email_: string, pan_?: string) {
        const email = email_.toLowerCase();
        const pan = pan_?.toLowerCase();
        const startedAt = new Date();

        const request = await statementRequestsService.createRequest(email, pan);
        const requestId = request.requestId;

        log.info(`[${requestId}] Started for ${email}`);

        // Save initial timing
        await statementRequestsService.syncTimings(requestId, { startedAt });

        try {
            // Phase 1: Browser submission
            const updatedRequest = await this.requestStatement(request, startedAt);

            // Phase 2: Email fetch + parse
            const data = await this.fetchReports(updatedRequest);

            // Phase 3: Mark complete
            const totalDurationMs = Date.now() - startedAt.getTime();
            await statementRequestsService.syncTimings(requestId, { totalDurationMs });
            log.info(`[${requestId}] Workflow complete in ${(totalDurationMs / 1000).toFixed(1)}s`);

            return data;
        } catch (err: any) {
            const totalDurationMs = Date.now() - startedAt.getTime();
            await statementRequestsService.syncTimings(requestId, {
                failedAt: new Date(),
                totalDurationMs,
            });
            log.error(`[${requestId}] Workflow failed after ${(totalDurationMs / 1000).toFixed(1)}s: ${err.message}`);
            throw err;
        }
    }

    private async requestStatement(request: IMFStatementsRequestsDoc, startedAt: Date) {
        const requestId = request.requestId;
        log.info(`[${requestId}] Submitting CAMS statement request...`);

        const generator = new CAMSBrowserClient();
        const params = {
            email: request.email,
            from_date: new Date('2018-01-01'),
            to_date: new Date(),
        };

        const results = await generator.submitForm(params, MFStatementCategory.ConsolidatedDetailedStatement);

        const requestSubmittedAt = new Date();
        const requestDurationMs = requestSubmittedAt.getTime() - startedAt.getTime();

        if (!results.success) {
            log.error(`[${requestId}] Submission failed: ${results.message} (attempt ${results.attempt})`);
            await statementRequestsService.markFailed(requestId, 'statement', {
                step: results.message?.includes('CAPTCHA') ? 'captcha' : 'submit',
                message: results.message,
                attempt: results.attempt,
            });
            throw new Error(`Statement submission failed: ${results.message}`);
        }

        log.info(`[${requestId}] Submission success — ref: ${results.refNumber}, captcha: ${results.captchaScore}, attempt: ${results.attempt}`);

        const requestMeta: MFStatementsRequests['requestMeta'] = {
            requestedAt: requestSubmittedAt,
            captchaToken: results.captchaToken,
            captchaScore: results.captchaScore,
            sessionId: results.sessionId,
            rawPayload: results.rawPayload,
            rawRequest: results.rawRequest,
            rawResponse: results.rawResponse,
            decryptedRequest: results.decryptedRequest,
            decryptedResponse: results.decryptedResponse,
            refNumber: results.refNumber,
            attachmentPassword: results.password,
            retries: results.attempt - 1,
            timings: {
                startedAt,
                requestSubmittedAt,
                requestDurationMs,
            },
        };

        const updated = await statementRequestsService.syncStatementGenData(request.requestId, requestMeta);
        return updated;
    }

    private async fetchReports(request: IMFStatementsRequestsDoc) {
        const requestId = request.requestId;
        const refNumber = request.requestMeta?.refNumber;
        const requestedAt = request.requestMeta?.requestedAt;

        if (!refNumber || !requestedAt) {
            throw new Error(`Missing refNumber or requestedAt for ${requestId}`);
        }

        log.info(`[${requestId}] Starting email fetch — ref: ${refNumber}`);

        const fetcher = new FetchReport();
        await fetcher.init(request.email);
        const emailSearchStart = Date.now();

        for (let attempt = 1; attempt <= EMAIL_MAX_RETRIES; attempt++) {
            const elapsed = ((Date.now() - emailSearchStart) / 1000).toFixed(0);
            log.info(`[${requestId}] Email check ${attempt}/${EMAIL_MAX_RETRIES} (${elapsed}s elapsed)`);

            try {
                const message = await fetcher.checkForStatementEmail(refNumber, requestedAt);

                if (message && message?.attachments?.length > 0) {
                    const emailFoundAt = new Date();
                    const emailSearchDurationMs = emailFoundAt.getTime() - emailSearchStart;
                    log.info(`[${requestId}] Email found after ${(emailSearchDurationMs / 1000).toFixed(1)}s — ${message.attachments.length} attachment(s)`);

                    await statementRequestsService.syncTimings(requestId, { emailFoundAt, emailSearchDurationMs });
                    await statementRequestsService.syncEmailData(requestId, {
                        receivedAt: message.date,
                        subject: message.subject,
                        text: message.textBody,
                        attachments: message.attachments,
                    });

                    // Parse the PDF
                    return await this.parseAndSave(request, fetcher, message);
                }
            } catch (err: any) {
                log.warn(`[${requestId}] Email check error: ${err.message}`);
            }

            // Update retry count in DB
            await statementRequestsService.updateEmailRetries(requestId);

            if (attempt < EMAIL_MAX_RETRIES) {
                const waitMs = EMAIL_INTERVALS[attempt - 1] || 120_000;
                log.info(`[${requestId}] Email not found, waiting ${waitMs / 1000}s...`);
                await sleep(waitMs);
            }
        }

        // Exhausted all retries
        const totalSearchTime = ((Date.now() - emailSearchStart) / 1000).toFixed(0);
        log.error(`[${requestId}] Email not found after ${EMAIL_MAX_RETRIES} retries (${totalSearchTime}s)`);
        await statementRequestsService.markFailed(requestId, 'email', {
            step: 'email',
            message: `Email not found after ${EMAIL_MAX_RETRIES} retries (${totalSearchTime}s)`,
        });
        throw new Error(`Email fetch exhausted for ${requestId}`);
    }

    private async parseAndSave(
        request: IMFStatementsRequestsDoc,
        fetcher: FetchReport,
        message: any
    ) {
        const requestId = request.requestId;
        log.info(`[${requestId}] Downloading attachment and parsing PDF...`);

        try {
            const attachments = await fetcher.downloadAttachement(message);
            const a = attachments[0];

            if (!a?.data) {
                throw new Error('Attachment download returned no data');
            }

            const parser = new DetailedStatementParser();
            const data = await parser.parse(a.data, DEFAULT_PASSWORD);
            const parsedAt = new Date();

            log.info(`[${requestId}] Parsed — ${data.folios?.length || 0} folios, ${data.portfolioSummary?.length || 0} fund houses`);

            await statementRequestsService.syncTimings(requestId, { parsedAt });
            await statementRequestsService.markComplete(requestId, data);

            // Sync to user collections (folios, transactions, snapshot, insights)
            try {
                const syncResult = await syncService.sync(data, requestId);
                log.info(`[${requestId}] Sync complete — folios: ${syncResult.foliosUpserted}, new txns: ${syncResult.transactionsInserted}, dupes: ${syncResult.transactionsDuplicated}`);
            } catch (syncErr: any) {
                log.warn(`[${requestId}] Sync failed (non-blocking): ${syncErr.message}`);
            }

            return data;
        } catch (err: any) {
            log.error(`[${requestId}] Parse failed: ${err.message}`);
            await statementRequestsService.markFailed(requestId, 'parse', {
                step: 'parse',
                message: err.message,
            });
            throw err;
        }
    }
}
