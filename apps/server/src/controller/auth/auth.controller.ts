import { sendAuthCookie } from '@/middlewares/cookies';
import googlePlugin from '@/plugins/google/google.plugin';
import userService from '@/services/user/user.service';
import { IRequest, IResponse } from '@/types/server';

export class AuthController {

     async getGoogleAuthUrl(req: IRequest, res: IResponse): Promise<IResponse | void> {
        const inviteCode = req.query.inviteCode;
        const url = googlePlugin.getAuthUrl(inviteCode as string);
        return res.redirect(url);
    }

    async googleAuthRedirect(req: IRequest, res: IResponse): Promise<IResponse | void> {
        const { code, inviteCode } = req.body;
        const googleUser = await googlePlugin.getGoogleUser(code);
        const user = await userService.upsertUser(
            {
                email: googleUser.email,
                username: googleUser.name,
                firstName: googleUser.given_name,
                lastName: googleUser.family_name,
                avatar: googleUser.picture,
                googleId: googleUser.id,
            },
            {
                inviteCode,
            }
        );
        const token = await userService.generateToken(user._id, );
        return res.json({ user, token });
    }

    async getLoggedInUser(req: IRequest, res: IResponse): Promise<IResponse | void> {
        if (!req.user) {
            return res.json(null);
        }
        return res.json(req.user);
    }

    async logout(req: IRequest, res: IResponse): Promise<IResponse | void> {
        await sendAuthCookie(req, res, null);
        return res.json({});
    }
    
}
