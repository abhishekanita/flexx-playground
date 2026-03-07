export interface User {
    _id: string;
    email: string;
    isGmailConnected: boolean;
    gmailSyncCursor: Date;
}
