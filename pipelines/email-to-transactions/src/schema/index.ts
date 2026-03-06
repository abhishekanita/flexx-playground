import { ModelFactory } from '@playground/schema';
import { model } from 'mongoose';
import { RawEmailsModel } from './raw-emails.schema';
const { GmailConnectionModel, UserModel } = ModelFactory.getAllModel(model);

//
export { GmailConnectionModel, UserModel, RawEmailsModel };
