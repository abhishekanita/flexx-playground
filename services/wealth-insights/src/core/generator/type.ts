export interface CamsStatementAPIResponse {
    status: {
        errorflag: number | boolean;
        errorcode: string;
        errormsg: string;
        version: string;
        captcha_validation: string;
        captcha_score: string;
        resdatetime: string;
    };
    detail: {
        session_id?: string;
        MESSAGE?: string;
        REF_NO?: string;
        TITLE?: string;
        QUOTA_EXCEED: 'Y' | 'N';
    };
    captcha_data?: {
        success: boolean;
        challenge_ts: string;
        hostname: string;
        score: number;
        action: string;
    };
}

export interface StatementResult {
    success: boolean;
    message: string;
    refNumber?: string;
    title?: string;
    errorCode?: string;
    rawPayload?: string;
    rawRequest?: string;
    rawResponse?: string;
    decryptedRequest?: string;
    decryptedResponse?: string;
    captchaToken?: string;
    captchaScore?: number;
    sessionId?: string;
    password?: string;
    isQuotaExceeded?: boolean;
    attempt?: number;
}
