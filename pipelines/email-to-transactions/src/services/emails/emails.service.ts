import { IRawEmailsDoc, RawEmailsModel } from '@/schema/raw-emails.schema';
import { BaseService } from '../base-service';

export class RawEmailsService extends BaseService<IRawEmailsDoc> {
    constructor() {
        super(RawEmailsModel);
    }

    async saveEmail() {
        //
    }
}
