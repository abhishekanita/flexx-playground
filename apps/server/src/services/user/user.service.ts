import { BaseService } from '@/definitions/base/BaseService';
import { AppError } from '@/definitions/exceptions/AppError';
import { UserModel } from '@/schema';
import { signJwt } from '@/utils/hashing';
import { IUserAccountDoc } from '@/schema';

class UserService extends BaseService<IUserAccountDoc> {
    otpExpiry: number;

    constructor() {
        super(UserModel);
        this.otpExpiry = 1000 * 60 * 5;
    }

    async getUser(id: string) {
        const user = await this.findById(id);
        if (!user) {
            throw new AppError('User not found', 401);
        }
        return user;
    }

    async upsertUser(
        userData: {
            email: string;
            username?: string;
            avatar?: string;
            googleId?: string;
            firstName?: string;
            lastName?: string;
        },
        data?: {
            inviteCode?: string;
        }
    ) {
        const user = await this.findOne({ email: userData.email });
        if (!user) {
            const newUser = await this.createNewUser(userData, data);
            return newUser;
        }
        return user;
    }

 

    async createNewUser(
        user: {
            email: string;
            username?: string;
            avatar?: string;
            googleId?: string;
            firstName?: string;
            lastName?: string;
        },
        data: { inviteCode?: string }
    ) {
        const newUser = await this.model.create({
            email: user?.email,
            username: user?.username,
            avatar: user?.avatar,
            googleId: user?.googleId,
            firstName: user?.firstName,
            lastName: user?.lastName,
            workplaces: [],
            workplaceId: null,
            isOnboarded: false,
        });
        return newUser;
    }

    async generateToken(userId: any) {
        const userIdString = userId.toString();
        const jwtToken = await signJwt({ accountId: userIdString });
        return jwtToken;
    }

}

export default new UserService();
