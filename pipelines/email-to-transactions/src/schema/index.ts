import { ModelFactory } from '@playground/schema';
import { model } from 'mongoose';
import { RawEmailsModel } from './raw-emails.schema';
import { ParserConfigModel } from './parser-configs.schema';
const { GmailConnectionModel, UserModel } = ModelFactory.getAllModel(model);

//
export { GmailConnectionModel, UserModel, RawEmailsModel, ParserConfigModel };
