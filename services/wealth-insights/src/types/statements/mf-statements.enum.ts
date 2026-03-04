export enum MFStatementStatus {
    RequestCreated = 'request-created',
    RequestFailed = 'request-failed',
    EmailReceived = 'email-received',
    EmailFailed = 'email-failed',
    ParsedFailed = 'parsed-failed',
    StatementParsed = 'statement-parsed',
}

export enum MFStatementCategory {
    ConsolidatedDetailedStatement = 'consolidated-detailed-statement',
}
