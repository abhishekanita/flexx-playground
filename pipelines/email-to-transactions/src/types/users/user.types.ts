export interface User {
    _id: string;
    email: string;
    isGmailConnected: boolean;
    gmailSyncCursor: Date;
    metadata: {
        fullname: string;
        dob: string; //dd-mm-yyyy
        pan: string;
        kotakCrn: string;
        phones: string[];
    };
}
