// ─────────────────────────────────────────────────────────────────────────────
// Gmail Plugin — API-level types (raw Gmail responses, OAuth, parsed messages)
// ─────────────────────────────────────────────────────────────────────────────

export interface GmailOAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    email: string;
}

export interface GmailRawMessage {
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
    internalDate: string;
    payload: GmailMessagePayload;
}

export interface GmailMessagePayload {
    mimeType: string;
    headers: GmailHeader[];
    body?: { size: number; data?: string };
    parts?: GmailMessagePart[];
}

export interface GmailMessagePart {
    mimeType: string;
    headers?: GmailHeader[];
    body?: { size: number; data?: string; attachmentId?: string };
    filename?: string;
    parts?: GmailMessagePart[];
}

export interface GmailAttachment {
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
}

export interface GmailHeader {
    name: string;
    value: string;
}

export interface GmailParsedMessage {
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    date: Date;
    textBody: string;
    htmlBody: string;
    snippet: string;
    attachments: GmailAttachment[];
    attachmentTexts: Record<string, string>;
}

export interface GmailMessageListResponse {
    messages?: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
}
