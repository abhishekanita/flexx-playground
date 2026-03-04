export interface CreditScoreAddress {
    line1: string;
    city: string;
    state: string;
    stateCode: string;
    pincode: string;
    country?: string;
}

export interface CreditScoreInitiateParams {
    firstName: string;
    middleName?: string;
    lastName: string;
    dob: string; // DD-MM-YYYY
    phone: string;
    email?: string;
    pan: string;
    address: CreditScoreAddress;
    gender?: 'M' | 'F';
}

export interface CreditScoreInitiateResult {
    orderId: string;
    reportId: string;
    redirectUrl?: string;
    status: string;
    rawResponse?: string;
}

export interface FetchReportParams {
    orderId: string;
    reportId: string;
}

export interface AuthorizeResult {
    orderId: string;
    reportId: string;
    status: string;
    statusDesc: string;
}

// --- Raw CRIF Report types ---

export interface CreditReportHeaderSegment {
    'DATE-OF-REQUEST': string;
    'PREPARED-FOR': string;
    'PREPARED-FOR-ID': string;
    'DATE-OF-ISSUE': string;
    'REPORT-ID': string;
    'BATCH-ID': string;
    'STATUS': string;
    'PRODUCT-TYPE': string;
    'PRODUCT-VER': string;
}

export interface CreditReportDOB {
    'DOB-DT': string;
    'AGE': string;
    'AGE-AS-ON': string;
}

export interface CreditReportID {
    'TYPE': string;
    'VALUE': string;
}

export interface CreditReportAddress {
    'TYPE': string;
    'ADDRESSTEXT': string;
    'CITY': string;
    'LOCALITY': string;
    'STATE': string;
    'PIN': string;
    'COUNTRY': string;
}

export interface CreditReportPhone {
    'TYPE': string;
    'VALUE': string;
}

export interface CreditReportEmail {
    'EMAIL': string;
}

export interface CreditReportApplicantSegment {
    'FIRST-NAME': string;
    'MIDDLE-NAME': string;
    'LAST-NAME': string;
    'GENDER': string;
    'APPLICANT-ID': string;
    'DOB': CreditReportDOB;
    'IDS': CreditReportID[];
    'ADDRESSES': CreditReportAddress[];
    'PHONES': CreditReportPhone[];
    'EMAILS': CreditReportEmail[];
    'ACCOUNT-NUMBER': string;
}

export interface CreditReportApplicationSegment {
    'INQUIRY-UNIQUE-REF-NO': string;
    'CREDIT-RPT-ID': string;
    'CREDIT-RPT-TRN-DT-TM': string;
    'CREDIT-INQ-PURPS-TYPE': string;
    'CREDIT-INQUIRY-STAGE': string;
    'CLIENT-CONTRIBUTOR-ID': string;
    'BRANCH-ID': string;
    'APPLICATION-ID': string;
    'ACNT-OPEN-DT': string;
    'LOAN-AMT': string;
    'LTV': string;
    'TERM': string;
    'LOAN-TYPE': string;
}

export interface CreditReportAccountsSummarySection {
    'NUMBER-OF-ACCOUNTS': string;
    'ACTIVE-ACCOUNTS': string;
    'OVERDUE-ACCOUNTS': string;
    'SECURED-ACCOUNTS': string;
    'UNSECURED-ACCOUNTS': string;
    'UNTAGGED-ACCOUNTS': string;
    'TOTAL-CURRENT-BALANCE': string;
    'TOTAL-SANCTIONED-AMT': string;
    'TOTAL-DISBURSED-AMT': string;
    'TOTAL-AMT-OVERDUE': string;
    'CURRENT-BALANCE-SECURED'?: string;
    'CURRENT-BALANCE-UNSECURED'?: string;
}

export interface CreditReportMFISummary {
    'NUMBER-OF-ACCOUNTS': string;
    'ACTIVE-ACCOUNTS': string;
    'OVERDUE-ACCOUNTS': string;
    'CLOSED-ACCOUNTS': string;
    'NO-OF-OTHER-MFIS': string;
    'NO-OF-OWN-MFIS': string;
    'TOTAL-OWN-CURRENT-BALANCE': string;
    'TOTAL-OWN-INSTALLMENT-AMT': string;
    'TOTAL-OWN-DISBURSED-AMT': string;
    'TOTAL-OWN-OVERDUE-AMT': string;
    'TOTAL-OTHER-CURRENT-BALANCE': string;
    'TOTAL-OTHER-INSTALLMENT-AMT': string;
    'TOTAL-OTHER-DISBURSED-AMT': string;
    'TOTAL-OTHER-OVERDUE-AMT': string;
    'MAX-WORST-DELINQUENCY': string;
}

export interface CreditReportAdditionalAttr {
    'ATTR-NAME': string;
    'ATTR-VALUE': string;
}

export interface CreditReportScoreFactor {
    'TYPE': string;
    'DESCRIPTION': string;
}

export interface CreditReportScore {
    'TYPE': string;
    'VALUE': string;
    'SCORING-FACTORS'?: CreditReportScoreFactor[];
}

export interface CreditReportAccountsSummary {
    'PRIMARY-ACCOUNTS-SUMMARY': CreditReportAccountsSummarySection;
    'SECONDARY-ACCOUNTS-SUMMARY': CreditReportAccountsSummarySection;
    'MFI-GROUP-ACCOUNTS-SUMMARY': CreditReportMFISummary;
    'ADDITIONAL-SUMMARY': CreditReportAdditionalAttr[];
    'PERFORM-ATTRIBUTES': any[];
}

export interface CreditReportTrends {
    'NAME': string;
    'DATES': string;
    'VALUES': string;
    'RESERVED1': string;
    'RESERVED2': string;
    'RESERVED3': string;
    'DESCRIPTION': string;
}

export interface CreditReportStandardData {
    'DEMOGS': { 'VARIATIONS': any[] };
    'EMPLOYMENT-DETAILS': any[];
    'TRADELINES': any[];
    'INQUIRY-HISTORY': any[];
    'SCORE': CreditReportScore[];
}

export interface CreditReportData {
    'STANDARD-DATA': CreditReportStandardData;
    'REQUESTED-SERVICES': any;
    'ACCOUNTS-SUMMARY': CreditReportAccountsSummary;
    'TRENDS': CreditReportTrends;
    'ALERTS': any[];
}

export interface CreditReport {
    'B2C-REPORT': {
        'HEADER-SEGMENT': CreditReportHeaderSegment;
        'REQUEST-DATA': {
            'APPLICANT-SEGMENT': CreditReportApplicantSegment;
            'APPLICATION-SEGMENT': CreditReportApplicationSegment;
        };
        'REPORT-DATA': CreditReportData;
    };
}

// --- Transformed (camelCase) types ---

export interface TransformedApplicant {
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    dob: string;
    pan: string;
    phone: string;
    email: string;
    address: {
        text: string;
        city: string;
        locality: string;
        state: string;
        pin: string;
        country: string;
    } | null;
}

export interface TransformedAccountsSummary {
    numberOfAccounts: number;
    activeAccounts: number;
    overdueAccounts: number;
    securedAccounts: number;
    unsecuredAccounts: number;
    totalCurrentBalance: number;
    totalSanctionedAmount: number;
    totalDisbursedAmount: number;
    totalAmountOverdue: number;
}

export interface TransformedCreditReport {
    creditScore: number;
    reportId: string;
    dateOfIssue: string;
    applicant: TransformedApplicant;
    accountsSummary: {
        primary: TransformedAccountsSummary;
        secondary: TransformedAccountsSummary;
    };
    tradelines: any[];
    inquiryHistory: any[];
    rawResponse: CreditReport;
}

// --- Main result types ---

export interface FetchReportResult {
    report: TransformedCreditReport;
    status: string;
}

export interface ICreditScore {
    initiate(params: CreditScoreInitiateParams): Promise<CreditScoreInitiateResult>;
    authorize(params: FetchReportParams): Promise<AuthorizeResult>;
    fetchReport(params: FetchReportParams): Promise<FetchReportResult>;
}
