export interface UserAccount {
    _id: string;
    email?: string;
    username: string;
    avatar: string;
    googleId?: string;
    createdAt: Date;
    updatedAt: Date;
}
