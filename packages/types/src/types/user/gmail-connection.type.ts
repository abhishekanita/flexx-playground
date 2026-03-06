export interface GmailConnection {
    email: string;
    googleId: string;
    name: string;
    picture: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    scopes: string[];
    isActive: boolean;
}
