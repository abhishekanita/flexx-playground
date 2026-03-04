export interface GmailOAuthTokens {
    accessToken: string;
    refreshToken: string;
    email: string;
    expiresAt: Date;
}

export interface GmailParsedMessage {
    id: string;
    threadId: string;
    from: string;
    to?: string;
    subject: string;
    date: Date;
    snippet: string;
    textBody?: string;
    htmlBody?: string;
    attachments: GmailAttachment[];
    attachmentTexts: Record<string, string>;
}

export interface GmailAttachment {
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
}
