export interface User {
    _id: string;
    email: string;
    isGmailConnected: boolean;
    emailsFetchedTill?: Date;
}
