import { StatementWorkflow } from '@/jobs/statements.workflow';
import { statementRequestsService } from '@/services/requests/statement-requests.service';
import { MFStatementCategory } from '@/types/statements';

export const testStatementGen = async () => {
    try {
        const userData = {
            email: 'abhishek12318@gmail.com',
            password: '12345678@',
        };
        const rId = 'a6e408a9-f655-4e8a-8b4b-89acc6929c40';
        const wf = new StatementWorkflow();
        const res = await wf.restart(rId);
        // const res = await wf.start(userData.email);
        console.log('Results:', res);
    } catch (err) {
        console.log(err);
    }
};
