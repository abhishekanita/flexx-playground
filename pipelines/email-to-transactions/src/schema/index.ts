import { ModelFactory } from '@playground/schema';
import { model } from 'mongoose';
import { RawEmailsModel } from './raw-emails.schema';
import { ParserConfigModel } from './parser-configs.schema';
export * from './parser-configs.schema';
export * from './raw-emails.schema';
export * from './sync-run.schema';
export * from './transaction.schema';
export * from './transaction-signal.schema';
export * from './financial-account.schema';
export * from './investment-account.schema';
export * from './investment-holding.schema';
export * from './investment-transaction.schema';
const { GmailConnectionModel, UserModel } = ModelFactory.getAllModel(model);

//
export { GmailConnectionModel, UserModel, RawEmailsModel, ParserConfigModel };
