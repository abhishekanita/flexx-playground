export interface MandateData {
    umn: string;
    payeeName: string;
    category: string;
    isPause: boolean;
    isRevoke: boolean;
    isUnpause: boolean;
    totalExecutionCount: number;
    totalExecutionAmount: number;
    status: string;
}

export interface SubscriptionCharge {
    date: string;
    amount: number;
}

export interface Subscription {
    id: string;
    name: string;
    amount: number;
    billingCycle: string;
    status: 'active' | 'inactive';
    source: 'apple_email' | 'npci' | 'combined';

    // Apple email data
    plan?: string;
    charges?: SubscriptionCharge[];
    totalSpent?: number;
    lastChargeDate?: string;

    // NPCI mandate data (for cancellation)
    mandate?: MandateData;
}

export interface ConnectionStatus {
    isConnected: boolean;
    phoneNumber: string | null;
}

export interface SubscriptionsResponse {
    subscriptions: Subscription[];
    needsReconnect: boolean;
}

export interface RevokeResult {
    intentUrl: string;
    app: string;
}
