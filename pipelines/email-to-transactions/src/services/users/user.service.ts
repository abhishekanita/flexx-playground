import { BaseService } from '../base-service';
import { IUserDoc, UserLocalModel } from '@/schema/user.schema';

class UserService extends BaseService<IUserDoc> {
    constructor() {
        super(UserLocalModel);
    }

    async getGmailSyncCursor(userId: string): Promise<Date | null> {
        const user = await this.findById(userId);
        return user?.gmailSyncCursor ?? null;
    }

    async updateGmailSyncCursor(userId: string, cursor: Date): Promise<void> {
        await this.findByIdAndUpdate(userId, { gmailSyncCursor: cursor });
    }
}

export const userService = new UserService();
