import { MFStatementCategory, MFStatementsRequests, MFStatementStatus } from '@/types/statements';
import { IMFStatementsRequestsDoc, MFStatementsRequestsModel } from '@/schema/statements/mf-statements-requests.schema';
import crypto from 'crypto';
import { BaseService } from '../base-service';

export class StatementRequestsService extends BaseService<IMFStatementsRequestsDoc> {
    constructor() {
        super(MFStatementsRequestsModel);
    }

    async getRequestsByEmail(email: string) {
        return this.model.find({ email }).lean();
    }

    async getRequestById(requestId: string) {
        return this.model.findOne({ requestId }).lean();
    }

    async createRequest(email: string, pan?: string) {
        const requestDocs = {
            requestId: crypto.randomUUID(),
            category: MFStatementCategory.ConsolidatedDetailedStatement,
            email,
            pan,
            source: 'CAMS' as const,
            status: MFStatementStatus.RequestCreated,
        };
        const doc = await this.model.create(requestDocs);
        return doc;
    }

    async syncEmailData(
        requestId: string,
        emailData: {
            receivedAt: Date;
            subject: string;
            text: string;
            attachments: {
                attachmentId: string;
                filename: string;
                mimeType: string;
                size: number;
            }[];
        }
    ) {
        await this.model.findOneAndUpdate(
            { requestId },
            {
                $set: {
                    status: MFStatementStatus.EmailReceived,
                    emailData: {
                        isReceived: true,
                        receivedAt: emailData.receivedAt,
                        subject: emailData.subject,
                        text: emailData.text,
                        attachments: emailData.attachments,
                        lastRetryAt: new Date(),
                    },
                },
            }
        );
    }

    async syncStatementGenData(requestId: string, requestMeta: MFStatementsRequests['requestMeta']) {
        return await this.model.findOneAndUpdate(
            { requestId },
            {
                $set: {
                    status: MFStatementStatus.RequestCreated,
                    requestMeta: requestMeta,
                },
            },
            { new: true }
        );
    }

    async syncTimings(requestId: string, timings: Partial<NonNullable<MFStatementsRequests['requestMeta']>['timings']>) {
        const setFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(timings)) {
            if (value !== undefined) {
                setFields[`requestMeta.timings.${key}`] = value;
            }
        }
        await this.model.findOneAndUpdate({ requestId }, { $set: setFields });
    }

    async markFailed(
        requestId: string,
        reason: 'statement' | 'email' | 'parse',
        error?: { step: string; message: string; attempt?: number }
    ) {
        const status =
            reason === 'email'
                ? MFStatementStatus.EmailFailed
                : reason === 'statement'
                ? MFStatementStatus.RequestFailed
                : MFStatementStatus.ParsedFailed;

        const setFields: Record<string, any> = { status };
        if (error) {
            setFields['requestMeta.error'] = error;
            setFields['requestMeta.timings.failedAt'] = new Date();
        }

        await this.model.findOneAndUpdate({ requestId }, { $set: setFields });
    }

    async markComplete(requestId: string, data: any) {
        const now = new Date();
        await this.model.findOneAndUpdate(
            { requestId },
            {
                $set: {
                    status: MFStatementStatus.StatementParsed,
                    hasData: true,
                    data,
                    'requestMeta.timings.completedAt': now,
                },
            }
        );
    }

    async startEmailRetries(requestId: string) {
        await this.model.findOneAndUpdate(
            { requestId },
            {
                $set: {
                    'emailData.retries': 0,
                    'emailData.isReceived': false,
                },
            }
        );
    }

    async updateEmailRetries(requestId: string) {
        await this.model.findOneAndUpdate(
            { requestId },
            {
                $inc: {
                    'emailData.retries': 1,
                },
                $set: {
                    'emailData.lastRetryAt': new Date(),
                    'emailData.nextRetryAt': new Date(new Date().getTime() + 600_1000),
                },
            }
        );
    }
}

export const statementRequestsService = new StatementRequestsService();
