import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { gmailPlugin } from '@/plugins/google/gmail.plugin';
import logger from '@/utils/logger';
import { gmailAuthService } from '@/services/gmail/gmail-auth.service';

const router: RouterType = Router();
const log = logger.createServiceLogger('AuthRoute');

router.get('/gmail/initiate', (req, res) => {
    try {
        const state = (req.query.state as string) || '';
        const authUrl = gmailPlugin.getAuthUrl(state);
        res.status(200).json({ url: authUrl });
    } catch (error: any) {
        log.error(`Gmail initiate failed: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
});

router.get('/gmail/callback', async (req, res) => {
    try {
        const code = req.query.code as string;
        if (!code) {
            res.status(400).json({ error: 'Missing authorization code' });
            return;
        }
        const connection = await gmailAuthService.createGmailConnection(code);
        log.info(`Gmail connection saved for ${connection.email}`);
        res.status(200).json({
            message: 'Gmail connected successfully',
            connection: {
                id: connection._id,
                email: connection.email,
                name: connection.name,
                picture: connection.picture,
            },
        });
    } catch (error: any) {
        log.error(`Gmail callback failed: ${error.message}`);
        res.status(500).json({ error: 'Failed to complete Gmail authentication' });
    }
});

export default router;
