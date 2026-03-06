import { syncEmailsForUser } from '@/pipelines/email-sync/email-sync.service';

export const runScripts = async () => {
    try {
        const userId = '69a4500be8ae76d9b62883f2';
        const result = await syncEmailsForUser(userId);
        logger.info('[Script] Sync result:', result);
    } catch (err) {
        console.log(err);
    }
};
