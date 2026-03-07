export interface User {
    _id: string;
    email: string;
    isGmailConnected: boolean;
    gmailSyncCursor: Date;
    metadata: {
        fullname: string;
        dob: string; //dd-mm-yyyy
        kotakCrn: string;
        phones: string[];
    };
}
