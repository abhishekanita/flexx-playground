export interface GmailFullMessage {
    messageId: string;
    threadId: string;
    fromRaw: string;
    fromName: string;
    fromEmail: string;
    fromDomain: string;
    subject: string;
    date: string;
    receivedAt: string;
    bodyHtml: string;
    bodyText: string;
    labels: string[];
    hasAttachments: boolean;
    attachments: GmailAttachmentMeta[];
}

export interface GmailAttachmentMeta {
    filename: string;
    mimeType: string;
    gmailAttachmentId: string;
    size: number;
}

export interface GmailSearchOptions {
    query: string;
    maxResults?: number;
    pageToken?: string;
}

export interface GmailSearchResult {
    messages: GmailFullMessage[];
    nextPageToken?: string;
    totalEstimate: number;
}
