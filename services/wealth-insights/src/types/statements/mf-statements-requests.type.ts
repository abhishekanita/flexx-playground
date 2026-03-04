import { MFStatementCategory, MFStatementStatus } from './mf-statements.enum';

export interface MFStatementsRequests {
    requestId: string;
    category: MFStatementCategory;
    email: string;
    pan?: string;
    source: 'CAMS';
    status: MFStatementStatus;
    requestMeta?: {
        requestedAt: Date;
        captchaToken: string;
        captchaScore: number;
        refNumber: string;
        sessionId: string;
        rawPayload?: string;
        rawRequest?: string;
        rawResponse?: string;
        decryptedRequest?: string;
        decryptedResponse?: string;
        retries: number;
        lastRetryAt?: Date;
        nextRetryAt?: Date;
        attachmentPassword?: string;
        timings?: {
            startedAt: Date;
            requestSubmittedAt?: Date;
            requestDurationMs?: number;
            emailFoundAt?: Date;
            emailSearchDurationMs?: number;
            parsedAt?: Date;
            completedAt?: Date;
            failedAt?: Date;
            totalDurationMs?: number;
        };
        error?: {
            step: 'browser' | 'submit' | 'captcha' | 'email' | 'parse';
            message: string;
            attempt?: number;
        };
    };
    emailData: {
        isReceived: boolean;
        receivedAt: Date;
        subject: string;
        text: string;
        attachments: {
            name: string;
            data: Buffer;
            url: string;
        }[];
        rawPayload?: string;
        rawResponse?: string;
        retries: number;
        lastRetryAt?: Date;
        nextRetryAt?: Date;
    };
    hasData?: boolean;
    rawData?: {
        type: 'pdf' | 'json';
        value: string;
    };
    data: any;
    createdAt?: Date;
    updatedAt?: Date;
}
