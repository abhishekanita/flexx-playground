import { EmailPipelineWorkflow } from '@/pipelines/email-pipeline';

export const runScripts = async () => {
    try {
        const userId = '69a4500be8ae76d9b62883f2';
        const pipeline = new EmailPipelineWorkflow(userId);
        await pipeline.run();
    } catch (err) {
        console.log(err);
    }
};
