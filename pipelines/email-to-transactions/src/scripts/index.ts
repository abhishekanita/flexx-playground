import { EmailPipelineWorkflow } from '@/pipelines/email-pipeline';

export const runScripts = async () => {
    try {
        const userId = '69ad593fb3726a47dec36515';
        const pipeline = new EmailPipelineWorkflow(userId);
        await pipeline.run();
    } catch (err) {
        console.log(err);
    }
};
