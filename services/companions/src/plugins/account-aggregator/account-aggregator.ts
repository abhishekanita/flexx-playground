import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class AccountAggregator {
    private accessToken: string | null = null;

    constructor(accessToken?: string) {
        this.accessToken = accessToken;
    }

    async login() {
        const path = 'User/login';
        const body = this.prepareBody({
            userId: 'channel@fintralease',
            password: '27dba773fc7f43e899a3a8faf9af4bdf',
        });
        console.log('body', body);
        const response = await this.makeRequest<{
            token: string;
        }>(path, 'POST', body);
        this.accessToken = response.body.token;
        console.log('this.accessToken', this.accessToken);
        return response.body.token;
    }

    async createConsentRequest(params: { customerId: string }) {
        const path = 'ConsentRequestPlus';
        const body = this.prepareBody({
            custId: params.customerId,
            consentDescription: 'Consent for Account Aggregation',
            templateName: 'BANK_STATEMENT_ONETIME',
            redirectUrl: 'https://app.credflow.in/account-aggregation/status?orgId=1244&rm_token=token',
            fip: [''],
            ConsentDetails: {},
            aaId: 'cookiejaraalive@finvu',
        });
        const response = await this.makeRequest<{
            encryptedRequest: string;
            requestDate: string;
            url: string;
            ConsentHandle: string;
            encryptedFiuId: string;
        }>(path, 'POST', body, true);
        return response.body;
    }

    async getConsentStatus(consentHandle: string, userId: string) {
        const path = `ConsentStatus/${consentHandle}/${userId}`;
        const response = await this.makeRequest<{
            consentStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
            consentId: string;
        }>(path, 'GET', null, true);
        return response.body;
    }

    async createFidataRequest(userId: string, consentHandle: string, consentId: string) {
        const path = `FIRequest`;
        const body = this.prepareBody({
            custId: userId,
            consentHandleId: consentHandle,
            consentId: consentId,
            dateTimeRangeFrom: '2025-09-30T08:10:45.006+0000',
            dateTimeRangeTo: '2025-11-30T08:10:45.006+0000',
            // dateTimeRangeFrom: '2025-08-31T00:00:00.000+0530',
            // dateTimeRangeTo: '2026-03-02T23:59:59.000+0530',
        });
        console.log('path', path, body);
        const response = await this.makeRequest<{
            ver: string;
            timestamp: string;
            txnid: string;
            consentId: string;
            sessionId: string;
            consentHandleId: string;
        }>(path, 'POST', body, true);
        return response.body;
    }

    async getFiDataStatus(consentId: string, sessionId: string, consentHandleId: string, userId: string) {
        const path = `FIStatus/${consentId}/${sessionId}/${consentHandleId}/${userId}`;
        const response = await this.makeRequest<{
            fiRequestStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
        }>(path, 'GET', null, true);
        return response.body;
    }

    async makeRequest<T>(
        path: string,
        method: string,
        data?: any,
        isAuth: boolean = false
    ): Promise<{
        header: {
            rid: string;
            ts: string;
            channelId: string;
        };
        body: T;
    }> {
        const response = await axios.request({
            url: `https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/${path}`,
            method,
            data,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(isAuth ? { Authorization: `Bearer ${this.accessToken}` } : {}),
            },
        });
        return response.data;
    }

    prepareBody(data: any) {
        return {
            header: {
                rid: uuidv4(),
                ts: new Date().toISOString(),
                channelId: 'fiulive@fintralease',
            },
            body: data,
        };
    }
}
