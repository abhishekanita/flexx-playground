export interface UserAccount {
     phoneNumber: string;
    email?: string;
    username: string;
    avatar: string;
    googleId?: string;
    isOnboarded: boolean;
    isSubscribed: boolean;
    isAdmin: boolean;
    isTester?: boolean;
    attributes: {
        interests?: string[];
        language?: string;
        [key: string]: any;
    };
    experiments: {
        [k: string]: string;
    };
    referralCode?: string;
    referredBy?: string;
    referredByCode?: string;
    referralCount: number;
    expoPushTokens: string[];
    isDeleted?: boolean;
    lastActiveAt: Date;
    createdAt: Date;
    updatedAt: Date;
}