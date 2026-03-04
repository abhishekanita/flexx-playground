import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/config';
import {
    IAccountAggregator,
    CreateConsentParams,
    ConsentRequestResult,
    DecryptParams,
    DecryptResult,
    ConsentStatusResult,
    FIDataResult,
} from '../account-aggregator.type';

export class FinfactorProvider implements IAccountAggregator {
    private client: AxiosInstance;
    private token: string | null = null;
    private tokenExp: number = 0;

    constructor() {
        this.client = axios.create({
            baseURL: `${config.finfactor.baseUrl}/finsense/API/V2`,
            headers: { 'Content-Type': 'application/json' },
        });

        this.client.interceptors.response.use(
            res => res,
            async error => {
                const original = error.config;
                if (error.response?.status === 401 && !original._retry) {
                    original._retry = true;
                    const token = await this.login();
                    original.headers['Authorization'] = token;
                    return this.client(original);
                }
                throw error;
            }
        );
    }

    private makeHeader(rid?: string) {
        return {
            rid: rid || uuidv4(),
            ts: new Date().toISOString(),
            channelId: config.finfactor.channelId,
        };
    }

    private isTokenExpired(): boolean {
        if (!this.token) return true;
        // Refresh 60s before actual expiry
        return Date.now() >= (this.tokenExp - 60) * 1000;
    }

    private parseJwtExp(token: string): number {
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            return payload.exp || 0;
        } catch {
            return 0;
        }
    }

    private async ensureToken(): Promise<string> {
        if (this.isTokenExpired()) {
            await this.login();
        }
        return this.token!;
    }

    async login(): Promise<string> {
        const { data } = await this.client.post('/User/Login', {
            header: this.makeHeader(),
            body: {
                userId: config.finfactor.userId,
                password: config.finfactor.password,
            },
        });

        const token = data.body?.token || data.token;
        if (!token) {
            throw new Error('Finfactor login failed: no token in response');
        }

        this.token = token;
        this.tokenExp = this.parseJwtExp(token);
        return token;
    }

    async createConsentRequest(params: CreateConsentParams): Promise<ConsentRequestResult> {
        const token = await this.ensureToken();
        const rid = uuidv4();

        console.log({
            custId: params.custId,
            consentDescription: params.consentDescription || 'Consent for Account Aggregation',
            templateName: params.templateName,
            userSessionId: 123,
            redirectUrl: params.redirectUrl,
            fip: params.fip || [''],
            ConsentDetails: {},
            aaId: config.finfactor.aaId,
        });
        const { data } = await this.client.post(
            '/ConsentRequestPlus',
            {
                header: this.makeHeader(rid),
                body: {
                    custId: params.custId,
                    consentDescription: params.consentDescription || 'Consent for Account Aggregation',
                    templateName: params.templateName,
                    userSessionId: Date.now(),
                    redirectUrl: params.redirectUrl,
                    fip: params.fip || [''],
                    ConsentDetails: {},
                    aaId: config.finfactor.aaId,
                },
            },
            { headers: { Authorization: token } }
        );

        return {
            rid,
            redirectUrl: data.body?.redirectUrl || '',
            consentHandle: data.body?.consentHandle,
            status: data.body?.status || data.status || 'UNKNOWN',
        };
    }

    async decrypt(params: DecryptParams): Promise<DecryptResult> {
        const token = await this.ensureToken();

        const { data } = await this.client.post(
            '/Webview/Decrypt',
            {
                header: this.makeHeader(),
                body: {
                    encryptedRequest: params.encryptedRequest,
                    requestDate: params.requestDate,
                    encryptedFiuId: params.encryptedFiuId,
                    aaId: params.aaId || config.finfactor.aaId,
                },
            },
            { headers: { Authorization: token } }
        );

        return {
            data: data.body || data,
            status: data.body?.status || data.status || 'UNKNOWN',
        };
    }

    async getConsentStatus(rid: string, custId: string): Promise<ConsentStatusResult> {
        const token = await this.ensureToken();

        const { data } = await this.client.get(`/ConsentStatus/${rid}/${custId}`, {
            headers: { Authorization: token },
        });

        return {
            consentHandle: data.body?.consentHandle || '',
            consentStatus: data.body?.consentStatus || data.status || 'UNKNOWN',
            sessionId: data.body?.sessionId,
        };
    }

    async fetchFIData(consentHandle: string, sessionId: string): Promise<FIDataResult> {
        const token = await this.ensureToken();

        const { data } = await this.client.get(`/FIDataFetch/${consentHandle}/${sessionId}`, {
            headers: {
                Authorization: token,
                Accept: 'application/xml',
            },
        });

        return {
            data: data.body || data,
            status: data.body?.status || data.status || 'UNKNOWN',
        };
    }
}
