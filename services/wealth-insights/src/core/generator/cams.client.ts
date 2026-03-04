import { MFStatementCategory } from '@/types/statements';
import { BrowserClient } from './helpers/browser-client';
import { DEFAULT_PASSWORD, DIALOG_HANDLERS, FormStep, getStatementConfig, INITIAL_PAGE } from './helpers/configs';
import { sleep } from '@/utils/sleept';
import { CamsStatementAPIResponse, StatementResult } from './type';
import { CAMSEncryptionHelper } from './helpers/encryption';
import logger from '@/utils/logger';

const MAX_SUBMIT_RETRIES = 3;
const RETRYABLE_PATTERNS = ['CAPTCHA_ERROR', 'Timeout', 'Navigation timeout', 'net::ERR_', 'Protocol error'];

export class CAMSBrowserClient extends BrowserClient {
    constructor() {
        super();
    }

    async submitForm(
        params: {
            email: string;
            from_date: Date;
            to_date: Date;
        },
        category: MFStatementCategory
    ): Promise<StatementResult> {
        let lastError: string = '';

        for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES; attempt++) {
            this.log.info(`Submit attempt ${attempt}/${MAX_SUBMIT_RETRIES}`);

            try {
                await this.init(INITIAL_PAGE);
                await this.dismissDialogs();
                const cfg = getStatementConfig(category);
                const page = this.page;
                await this.waitForFormReady([cfg.form.selectors.email, cfg.form.submitButton]);
                await this.fillForm(page, params, cfg.formSteps, cfg.form.selectors);
                this.log.info('Waiting for reCAPTCHA auto-resolve...');
                await sleep(2000 + Math.random() * 1000);

                const intercepted = await this.submitAndIntercept(page, cfg.form.submitButton);
                const result = this.parseResponse(intercepted.response);
                result.rawRequest = intercepted.rawRequest;
                result.decryptedRequest = intercepted.decryptedRequest;
                result.rawResponse = intercepted.rawResponse;
                result.decryptedResponse = intercepted.decryptedResponse;
                result.sessionId = intercepted.sessionId;
                result.captchaToken = intercepted.captchaToken;
                result.captchaScore = intercepted.captchaScore;
                result.password = DEFAULT_PASSWORD;
                result.attempt = attempt;

                this.log.info(`Submit result: success=${result.success}, ref=${result.refNumber}, attempt=${attempt}`);
                return result;
            } catch (err) {
                lastError = err?.message || 'Unknown error';
                this.log.error(`Attempt ${attempt} failed: ${lastError}`);

                const isRetryable = RETRYABLE_PATTERNS.some(p => lastError.includes(p));
                if (!isRetryable || attempt === MAX_SUBMIT_RETRIES) {
                    this.log.error(`Non-retryable or final attempt — giving up`);
                    break;
                }

                this.log.info('Retryable error — resetting proxy and retrying...');
                await this.resetProxy();
            } finally {
                await this.close();
            }
        }

        return {
            success: false,
            message: lastError,
            attempt: MAX_SUBMIT_RETRIES,
        };
    }

    private async submitAndIntercept(
        page: any,
        submitSelector: string
    ): Promise<{
        response: CamsStatementAPIResponse;
        rawRequest?: string;
        decryptedRequest?: string;
        rawResponse?: string;
        decryptedResponse?: string;
        sessionId?: string;
        captchaToken?: string;
        captchaScore?: number;
    }> {
        this.log.info('Clicking submit and intercepting response...');
        const encryption = new CAMSEncryptionHelper();
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                page.off('response', handler);
                reject(new Error('Timeout: no statement response after 30s'));
            }, 30_000);

            let sessionId: string | undefined;
            let captchaToken: string | undefined;
            let captchaScore: number | undefined;
            let rawRequest: string | undefined;
            let decryptedRequest: string | undefined;

            const handler = async (res: any) => {
                if (!res.url().includes('/api/v1/camsonline') || res.request().method() !== 'POST') return;

                try {
                    // Capture request body on first intercepted call
                    if (!rawRequest) {
                        try {
                            rawRequest = res.request().postData();
                            if (rawRequest) {
                                decryptedRequest = encryption.decryptRequest(rawRequest);
                                this.log.info(`Captured request payload (${rawRequest.length} chars)`);
                            }
                        } catch (e: any) {
                            this.log.warn(`Failed to capture/decrypt request: ${e.message}`);
                        }
                    }

                    const body = await res.text();
                    this.log.info(`Intercepted API response (${body.length} chars)`);

                    const decrypted = encryption.decryptResponse<CamsStatementAPIResponse>(body);
                    this.log.info(
                        `Decrypted — errorflag: ${decrypted.status?.errorflag}, keys: ${Object.keys(decrypted.detail || {}).join(',')}`
                    );

                    // Capture session response data
                    if (decrypted.detail?.session_id) {
                        sessionId = decrypted.detail.session_id;
                        this.log.info(`Session response — sessionId: ${sessionId}`);
                        return;
                    }

                    // Capture captcha data
                    if (decrypted.captcha_data) {
                        captchaToken = decrypted.status?.captcha_validation;
                        captchaScore = decrypted.captcha_data.score;
                    }

                    // This is the actual statement response
                    this.log.info('Statement response received');
                    page.off('response', handler);
                    clearTimeout(timeout);
                    resolve({
                        response: decrypted as CamsStatementAPIResponse,
                        rawRequest,
                        decryptedRequest,
                        rawResponse: body,
                        decryptedResponse: JSON.stringify(decrypted),
                        sessionId,
                        captchaToken,
                        captchaScore,
                    });
                } catch (e: any) {
                    this.log.warn(`Failed to decrypt response: ${e.message}`);
                }
            };

            page.on('response', handler);
            await page.click(submitSelector);
        });
    }

    private async dismissDialogs(): Promise<void> {
        const page = this.page;

        // Wait for dialog to appear — it may render after a short Angular animation delay
        const hasDialog = await page
            .waitForSelector('mat-dialog-container', { timeout: 8_000 })
            .catch(() => null);

        if (!hasDialog) {
            this.log.info('No dialogs appeared after waiting, skipping...');
            return;
        }

        this.log.info('Dialog container detected, processing handlers...');

        for (const handler of DIALOG_HANDLERS) {
            const maxAttempts = handler.maxAttempts || 1;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                // Wait briefly for this specific dialog type to render
                const detected = await page
                    .waitForSelector(handler.detect, { timeout: 3_000 })
                    .catch(() => null);
                if (!detected) break;

                this.log.info(`Dialog "${handler.name}" found (attempt ${attempt + 1})`);
                for (const action of handler.actions) {
                    if (action.type === 'click') {
                        // Wait for the action element to be available before clicking
                        await page.waitForSelector(action.selector, { timeout: 3_000 }).catch(() => null);
                        await page.evaluate((sel: string) => {
                            const el = document.querySelector(sel) as HTMLElement;
                            if (el) {
                                const inner = el.querySelector('input[type="radio"]') || el.querySelector('.mat-radio-container') || el;
                                (inner as HTMLElement).click();
                            }
                        }, action.selector);
                        await sleep(300);
                    }
                }

                if (handler.waitForHidden) {
                    await page.waitForSelector(handler.waitForHidden, { hidden: true, timeout: 5_000 }).catch(() => {});
                    await sleep(500);
                }

                await sleep(500);
            }
        }

        this.log.info('All dialogs dismissed');
    }

    private parseResponse(response: CamsStatementAPIResponse): StatementResult {
        this.log.info(`Response status: errorflag=${response.status?.errorflag}, msg=${response.status?.errormsg}`);

        if (response.status?.errorflag === 0 || response.status?.errorflag === false) {
            return {
                success: true,
                message: response.detail?.MESSAGE || response.status.errormsg || 'Statement requested successfully',
                refNumber: response.detail?.REF_NO,
                title: response.detail?.TITLE,
                isQuotaExceeded: response?.detail?.QUOTA_EXCEED === 'Y',
            };
        }

        const errMsg = response.status?.errormsg || 'Unknown error';
        if (response?.captcha_data?.success === false || this.isCaptchaRelated(errMsg)) {
            throw new Error(`CAPTCHA_ERROR. Score: ${response?.captcha_data?.score}`);
        }

        return {
            success: false,
            message: errMsg,
            errorCode: response.status?.errorcode,
            isQuotaExceeded: response?.detail?.QUOTA_EXCEED === 'Y',
        };
    }

    private isCaptchaRelated(msg?: string): boolean {
        if (!msg) return false;
        const lower = msg.toLowerCase();
        return lower.includes('captcha') || lower.includes('recaptcha');
    }
}
