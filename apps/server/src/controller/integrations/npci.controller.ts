import { npciPlugin } from '@/plugins/npci/npci.plugin';
import { IntegrationNpciModel, MandateModel } from '@/schema';
import integrationsService from '@/services/integrations/integrations.service';
import mandateService from '@/services/mandates/mandate.service';
import { IRequest, IResponse } from '@/types/server';
import { UserModel } from '@/schema';
import logger from '@/utils/logger';

export class NpciController {
    async getConnectionStatus(req: IRequest, res: IResponse) {
        const userId = req.user!._id.toString();
        const connected = await IntegrationNpciModel.findOne({ userId, isConnected: true }).lean();
        if (connected) {
            return res.json({ isConnected: true, phoneNumber: connected.phoneNumber });
        }
        // Return saved phone number even when disconnected (for re-auth prefill)
        const any = await IntegrationNpciModel.findOne({ userId }).sort({ updatedAt: -1 }).lean();
        return res.json({ isConnected: false, phoneNumber: any?.phoneNumber ?? null });
    }

    async connect(req: IRequest, res: IResponse) {
        const { phoneNumber } = req.body;
        const userId = req.user!._id.toString();
        const result = await npciPlugin.sendOTP(phoneNumber);
        await UserModel.findByIdAndUpdate(userId, { phoneNumber });
        return res.json(result);
    }

    async verifyConnection(req: IRequest, res: IResponse) {
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

    async getMandates(req: IRequest, res: IResponse) {
        const userId = req.user!._id.toString();
        const integration = await IntegrationNpciModel.findOne({ userId, isConnected: true }).lean();

        // Sync Apple subscriptions in background (only needs Gmail, not NPCI)
        mandateService.syncAppleSubscriptions(userId).catch(err =>
            logger.error('Apple subscription sync failed', { error: err.message })
        );

        // Not connected — return unified subscriptions from cached data
        if (!integration) {
            const hasMandates = await MandateModel.exists({ userId });
            const subscriptions = await mandateService.getSubscriptions(userId);
            return res.json({ subscriptions, needsReconnect: !!hasMandates });
        }

        npciPlugin.loginFromOTPResponse({
            access_token: integration.accessToken,
            csrf_token: integration.csrfToken,
            session_id: integration.sessionId,
            user: { id: '', created_at: '', phone: integration.phoneNumber },
        });

        let mandates;
        try {
            mandates = await npciPlugin.getMandates(integration.phoneNumber);
        } catch (err: any) {
            if (err.response?.status === 401) {
                await IntegrationNpciModel.updateOne({ _id: integration._id }, { $set: { isConnected: false } });
                const subscriptions = await mandateService.getSubscriptions(userId);
                return res.json({ subscriptions, needsReconnect: true });
            }
            throw err;
        }

        await mandateService.syncMandates(userId, mandates);

        const subscriptions = await mandateService.getSubscriptions(userId);
        return res.json({ subscriptions, needsReconnect: false });
    }

    async forceSync(req: IRequest, res: IResponse) {
        const userId = req.user!._id.toString();
        await mandateService.syncAppleSubscriptions(userId, true);
        const subscriptions = await mandateService.getSubscriptions(userId);
        return res.json({ subscriptions });
    }

    async revokeMandate(req: IRequest, res: IResponse) {
        const { umn, app } = req.body;
        const userId = req.user!._id.toString();
        const integration = await IntegrationNpciModel.findOne({ userId, isConnected: true }).lean();
        if (!integration) {
            return res.status(400).json({ error: 'NPCI not connected' });
        }

        npciPlugin.loginFromOTPResponse({
            access_token: integration.accessToken,
            csrf_token: integration.csrfToken,
            session_id: integration.sessionId,
            user: { id: '', created_at: '', phone: integration.phoneNumber },
        });

        let mandates;
        try {
            mandates = await npciPlugin.getMandates(integration.phoneNumber);
        } catch (err: any) {
            if (err.response?.status === 401) {
                await IntegrationNpciModel.updateOne({ _id: integration._id }, { $set: { isConnected: false } });
                return res.status(401).json({ error: 'NPCI_SESSION_EXPIRED' });
            }
            throw err;
        }

        const mandate = mandates.find(m => m.umn === umn);
        if (!mandate) {
            return res.status(404).json({ error: 'Mandate not found' });
        }

        const result = await npciPlugin.revokeMandate(integration.phoneNumber, mandate);
        return res.json({ intentUrl: result.intentUrl, app: result.app });
    }
}
