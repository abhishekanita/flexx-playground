import googlePlugin from '@/plugins/google/google.plugin';
import { npciPlugin } from '@/plugins/npci/npci.plugin';
import integrationsService from '@/services/integrations/integrations.service';
import { IRequest, IResponse } from '@/types/server';

export class IntegrationsController {
    async getAllIntegrations(req: IRequest, res: IResponse) {
        const integrations = integrationsService.getAllIntegrations();
        return res.json(integrations);
    }

    async getConnectedIntegrations(req: IRequest, res: IResponse) {
        const userId = req.user!._id.toString();
        const connected = await integrationsService.getConnectedIntegrations(userId);
        return res.json(connected);
    }

    async initiateGoogleIntegration(req: IRequest, res: IResponse) {
        const userId = req.user!._id.toString();
        const url = googlePlugin.getGmailAuthUrl(userId);
        return res.json({ url });
    }

    async initiateGoogleIntegrationRedirect(req: IRequest, res: IResponse) {
        const { code } = req.body;
        const userId = req.user!._id.toString();
        const { user, tokens } = await googlePlugin.getGmailTokensAndUser(code);
        await integrationsService.upsertGmailIntegration(userId, {
            email: user.email,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            scopes: tokens.scopes,
        });
        return res.json({ success: true, email: user.email });
    }

    async initiateNpciIntegration(req: IRequest, res: IResponse) {
        const { phoneNumber } = req.body;
        const result = await npciPlugin.sendOTP(phoneNumber);
        return res.json(result);
    }

    async initiateNpciIntegrationOtp(req: IRequest, res: IResponse) {
        const { phoneNumber, otp } = req.body;
        const userId = req.user!._id.toString();
        const result = await npciPlugin.validateOTP(phoneNumber, otp);
        await integrationsService.upsertNpciIntegration(userId, {
            phoneNumber,
            accessToken: result.access_token,
            csrfToken: result.csrf_token,
            sessionId: result.session_id,
        });
        return res.json({ success: true, phoneNumber });
    }
}
