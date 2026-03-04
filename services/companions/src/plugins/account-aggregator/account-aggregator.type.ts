export interface CreateConsentParams {
    custId: string;
    redirectUrl: string;
    templateName: string;
    fip?: string[];
    consentDescription?: string;
}

export interface ConsentRequestResult {
    rid: string;
    redirectUrl: string;
    consentHandle?: string;
    status: string;
}

export interface DecryptParams {
    encryptedRequest: string;
    requestDate: string;
    encryptedFiuId: string;
    aaId?: string;
}

export interface DecryptResult {
    data: any;
    status: string;
}

export interface ConsentStatusResult {
    consentHandle: string;
    consentStatus: string;
    sessionId?: string;
}

export interface FIDataResult {
    data: any;
    status: string;
}

export interface IAccountAggregator {
    login(): Promise<string>;
    createConsentRequest(params: CreateConsentParams): Promise<ConsentRequestResult>;
    decrypt(params: DecryptParams): Promise<DecryptResult>;
    getConsentStatus(rid: string, custId: string): Promise<ConsentStatusResult>;
    fetchFIData(consentHandle: string, sessionId: string): Promise<FIDataResult>;
}
