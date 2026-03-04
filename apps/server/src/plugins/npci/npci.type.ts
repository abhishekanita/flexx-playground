export interface SendOTPResponse {
    message: string;
}

export interface ValidateOTPResponse {
    access_token: string;
    csrf_token: string;
    session_id: string;
    user: {
        id: string;
        created_at: string;
        phone: string;
    };
}

export interface Mandate {
    umn: string;
    payeeName: string;
    amount: number;
    recurrance: string;
    status: 'ACTIVE' | 'INACTIVE';
    category: string;
    totalExecutionCount: number;
    totalExecutionAmount: number;
    isPause: boolean;
    isRevoke: boolean;
    isUnpause: boolean;
}

export interface AccountMapping {
    app: string;
    bank: string;
    remarks: string;
    vpa: string;
}

// ─── UPI app deep-link schemes ───────────────────────────────────────────────

export const UPI_APP_SCHEMES = {
    PAYTM: 'paytmmp',
    GOOGLE_PAY: 'gpay',
    PHONEPE: 'phonepe',
    BHIM: 'upi',
    CRED: 'cred',
    AMAZON_PAY: 'amazonpay',
    WHATSAPP: 'whatsapp',
} as const;

export type UpiApp = keyof typeof UPI_APP_SCHEMES;

// ─── Chat / Revoke flow ─────────────────────────────────────────────────────

export interface CreateChatResponse {
    message: string;
    chat: {
        id: string;
        title: string;
        created_at: string;
        updated_at: string;
        message_count: number;
        last_message_content: string;
    };
}

export interface RevokeResult {
    intentUrl: string;
    app: string;
    mandate: Mandate;
}

// ─── Mandate Insights ───────────────────────────────────────────────────────

export interface MandateInsights {
    summary: {
        totalMandates: number;
        activeMandates: number;
        inactiveMandates: number;
        totalAmountDebited: number;
        maxMonthlyExposure: number;
        annualizedExposure: number;
    };
    shockInsights: string[];
    generalInsights: string[];
    topSpenders: { payeeName: string; totalSpent: number; executionCount: number }[];
    categoryBreakdown: { category: string; count: number; maxExposure: number }[];
    risks: string[];
    recommendations: string[];
}

// ─── Raw API response shapes ──────────────────────────────────────────────────

export interface RawMandateMetadataResponse {
    [category: string]: {
        count: number;
        mandates: {
            umn: string;
            'payee name': string;
            amount: number;
            recurrance: string;
            'Latest Status': 'INACTIVE' | 'ACTIVE';
            'Total Execution Count': number;
            'Total Execution Amount': number;
            is_pause: boolean;
            is_revoke: boolean;
            is_unpause: boolean;
        }[];
    };
}
