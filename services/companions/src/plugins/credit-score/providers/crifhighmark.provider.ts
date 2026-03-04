import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/config';
import {
    ICreditScore,
    CreditScoreInitiateParams,
    CreditScoreInitiateResult,
    FetchReportParams,
    FetchReportResult,
    AuthorizeResult,
    CreditReport,
    TransformedCreditReport,
} from '../credit-score.type';

export class CrifHighmarkProvider implements ICreditScore {
    private client: AxiosInstance;
    private cookies: string = '';

    constructor() {
        this.client = axios.create({
            baseURL: `${config.crifHighmark.baseUrl}/Inquiry/do.getSecureService/DTC`,
            headers: {
                accessCode: config.crifHighmark.accessCode,
                appID: config.crifHighmark.appId,
                merchantID: config.crifHighmark.merchantId,
                // 'Content-Type': 'text/plain',
            },
        });
    }

    private extractCookies(setCookieHeaders: string | string[] | undefined): string {
        if (!setCookieHeaders) return '';
        const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        return headers.map(c => c.split(';')[0]).join('; ');
    }

    async initiate(params: CreditScoreInitiateParams): Promise<CreditScoreInitiateResult> {
        const orderId = uuidv4();

        // Build pipe-delimited body per CRIF HighMark spec:
        // FIRST_NAME|MIDDLE_NAME|LAST_NAME||DOB|||PHONE|||EMAIL||PAN||ACCOUNT_ID|<20 reserved>|MERCHANT_ID|PRODUCT_CODE|Y|
        const fields = [
            params.firstName, // 1  - first name
            params.middleName || '', // 2  - middle name
            params.lastName, // 3  - last name
            '', // 4  - reserved
            params.dob, // 5  - DOB (DD-MM-YYYY)
            '', // 6  - reserved
            '', // 7  - reserved
            params.phone, // 8  - phone
            '', // 9  - reserved
            '', // 10 - reserved
            params.email || '', // 11 - email
            '', // 12 - reserved
            params.pan, // 13 - PAN
            '', // 14 - reserved
            '', // 15 - account ID (optional)
            '', // 16 - reserved
            '', // 17 - reserved
            '', // 18 - reserved
            '', // 19 - reserved
            '', // 20 - reserved
            '', // 21 - reserved
            '', // 22 - reserved
            '', // 23 - reserved
            '', // 24 - reserved
            '', // 25 - reserved
            '', // 26 - reserved
            '', // 27 - reserved
            '', // 28 - reserved
            '', // 29 - reserved
            '', // 30 - reserved
            '', // 31 - reserved
            '', // 32 - reserved
            '', // 33 - reserved
            '', // 34 - reserved
            '', // 35 - reserved
            config.crifHighmark.merchantId, // 36 - merchant ID
            config.crifHighmark.productCode, // 37 - product code
            'Y', // 38 - consent flag
            '', // 39 - trailing
        ];

        const body = fields.join('|');

        console.log('[CRIF] Initiate body:', body);
        const response = await this.client.post('/initiate', body, {
            headers: { orderId },
        });
        const data = response.data;
        this.cookies = this.extractCookies(response.headers['set-cookie']);
        console.log('[CRIF] Initiate response:', typeof data, data);
        console.log('[CRIF] Captured cookies:', this.cookies);

        const reportId = typeof data === 'object' ? data.reportId : '';
        const rawResponse = typeof data === 'string' ? data : JSON.stringify(data);

        return {
            orderId,
            reportId: reportId || '',
            redirectUrl: typeof data === 'object' ? data.redirectURL : undefined,
            status: reportId ? 'SUCCESS' : 'PENDING',
            rawResponse,
        };
    }

    private buildResponseBody(params: FetchReportParams, includeExtraY = false): string {
        const fields = [
            params.orderId,
            params.reportId,
            config.crifHighmark.accessCode,
            `${config.crifHighmark.cirBaseUrl}/Inquiry/B2B/secureService.action`,
            'N',
            'N',
            'Y',
        ];
        if (includeExtraY) {
            fields.push('Y');
        }
        return fields.join('|');
    }

    async authorize(params: FetchReportParams): Promise<AuthorizeResult> {
        // Step 2: Call authenticate
        const body = this.buildResponseBody(params);
        console.log('body', body);

        const response = await this.client.post('/response', body, {
            headers: {
                orderId: params.orderId,
                reportId: params.reportId,
                requestType: 'AUTHENTICATE',
                'Content-Type': 'application/xml',
                Accept: 'application/xml',
                Cookie: this.cookies,
            },
        });
        // Update cookies from authenticate response for fetchReport
        const data = response.data;

        return {
            orderId: data.orderId || params.orderId,
            reportId: data.reportId || params.reportId,
            status: data.status || 'UNKNOWN',
            statusDesc: data.statusDesc || '',
        };
    }

    async fetchReport(params: FetchReportParams): Promise<FetchReportResult> {
        const body = this.buildResponseBody(params, true);

        const { data } = await this.client.post('/response', body, {
            headers: {
                orderId: params.orderId,
                reportId: params.reportId,
                requestType: 'GET_REPORT',
                'Content-Type': 'application/xml',
                Accept: 'application/xml',
                Cookie: this.cookies,
            },
        });

        const raw: CreditReport = typeof data === 'string' ? JSON.parse(data) : data;

        return {
            report: this.transformReport(raw),
            status: 'SUCCESS',
        };
    }

    private transformReport(raw: CreditReport): TransformedCreditReport {
        const b2c = raw['B2C-REPORT'];
        const header = b2c['HEADER-SEGMENT'];
        const applicant = b2c['REQUEST-DATA']['APPLICANT-SEGMENT'];
        const reportData = b2c['REPORT-DATA'];
        const standardData = reportData['STANDARD-DATA'];
        const summary = reportData['ACCOUNTS-SUMMARY'];

        // Extract credit score from SCORE array
        const scores = standardData['SCORE'] || [];
        const scoreEntry = scores.find(s => s['VALUE'] && s['VALUE'] !== '-1') || scores[0];
        const creditScore = scoreEntry ? parseInt(scoreEntry['VALUE'], 10) || 0 : 0;

        const firstAddress = applicant['ADDRESSES']?.[0] || null;
        const firstPhone = applicant['PHONES']?.[0];
        const firstEmail = applicant['EMAILS']?.[0];
        const panId = applicant['IDS']?.find(id => id['TYPE'] === 'ID07');

        const primarySummary = summary['PRIMARY-ACCOUNTS-SUMMARY'];
        const secondarySummary = summary['SECONDARY-ACCOUNTS-SUMMARY'];

        return {
            creditScore,
            reportId: header['REPORT-ID'],
            dateOfIssue: header['DATE-OF-ISSUE'],
            applicant: {
                firstName: applicant['FIRST-NAME'],
                middleName: applicant['MIDDLE-NAME'],
                lastName: applicant['LAST-NAME'],
                gender: applicant['GENDER'],
                dob: applicant['DOB']?.['DOB-DT'] || '',
                pan: panId?.['VALUE'] || '',
                phone: firstPhone?.['VALUE'] || '',
                email: firstEmail?.['EMAIL'] || '',
                address: firstAddress
                    ? {
                          text: firstAddress['ADDRESSTEXT'],
                          city: firstAddress['CITY'],
                          locality: firstAddress['LOCALITY'],
                          state: firstAddress['STATE'],
                          pin: firstAddress['PIN'],
                          country: firstAddress['COUNTRY'],
                      }
                    : null,
            },
            accountsSummary: {
                primary: this.transformAccountsSummary(primarySummary),
                secondary: this.transformAccountsSummary(secondarySummary),
            },
            tradelines: standardData['TRADELINES'] || [],
            inquiryHistory: standardData['INQUIRY-HISTORY'] || [],
            rawResponse: raw,
        };
    }

    private transformAccountsSummary(section: any) {
        return {
            numberOfAccounts: parseInt(section['NUMBER-OF-ACCOUNTS'], 10) || 0,
            activeAccounts: parseInt(section['ACTIVE-ACCOUNTS'], 10) || 0,
            overdueAccounts: parseInt(section['OVERDUE-ACCOUNTS'], 10) || 0,
            securedAccounts: parseInt(section['SECURED-ACCOUNTS'], 10) || 0,
            unsecuredAccounts: parseInt(section['UNSECURED-ACCOUNTS'], 10) || 0,
            totalCurrentBalance: parseFloat(section['TOTAL-CURRENT-BALANCE']) || 0,
            totalSanctionedAmount: parseFloat(section['TOTAL-SANCTIONED-AMT']) || 0,
            totalDisbursedAmount: parseFloat(section['TOTAL-DISBURSED-AMT']) || 0,
            totalAmountOverdue: parseFloat(section['TOTAL-AMT-OVERDUE']) || 0,
        };
    }
}
