# Chat API Documentation

Base URL: `/api/v1/chat`

All endpoints require authentication (user must be logged in).

---

## Data Models

### ChatSession
```typescript
{
  _id: string;
  userId: string;
  title?: string;
  isActive: boolean;       // true = processing, false = ready
  isTitleGenerated: boolean;
  createdAt: string;       // ISO date
  updatedAt: string;       // ISO date
}
```

### ChatMessage
```typescript
{
  _id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'tool_call' | 'tool_result';
  content: string | null;
  toolCall?: {
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
  };
  toolResult?: {
    toolCallId: string;
    toolName: string;
    result: any;
  };
  createdAt: string;       // ISO date
}
```

---

## Endpoints

### 1. Create Session (with first message)

Creates a new chat session with the first user message. Returns immediately with the session.
The assistant's response is generated asynchronously - poll messages to get it.

**Request**
```
POST /api/v1/chat/sessions
```

**Body**
```typescript
{
  content: string;  // First message content
}
```

**Response** `201 Created`
```typescript
{
  session: {
    _id: string;
    userId: string;
    title?: string;          // Initially undefined, generated async
    isActive: boolean;       // true = processing first response
    isTitleGenerated: boolean; // false initially
    createdAt: string;
    updatedAt: string;
  }
}
```

**Notes**
- Returns immediately after saving user message
- `isActive: true` means assistant is still processing
- Poll `GET /sessions/:id/messages` to get the assistant's response
- Poll `GET /sessions/:id` to get the generated title when `isTitleGenerated` becomes true
- When processing completes, `isActive` becomes `false`

---

### 2. List Sessions

Get all chat sessions for the authenticated user.

**Request**
```
GET /api/v1/chat/sessions
```

**Query Parameters**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 20 | Number of sessions to return |
| cursor | string | - | Pagination cursor (session ID) |

**Response** `200 OK`
```typescript
{
  sessions: Array<{
    _id: string;
    title?: string;
    isActive: boolean;
    isTitleGenerated: boolean;
    lastMessage?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  cursor?: string;
  hasMore: boolean;
}
```

---

### 3. Get Session

Get a specific session by ID. Use this to poll for title generation.

**Request**
```
GET /api/v1/chat/sessions/:sessionId
```

**Response** `200 OK`
```typescript
{
  session: {
    _id: string;
    userId: string;
    title?: string;
    isActive: boolean;
    isTitleGenerated: boolean;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Errors**
- `404 Not Found` - Session not found or doesn't belong to user

---

### 4. Delete Session

Delete a chat session and all its messages.

**Request**
```
DELETE /api/v1/chat/sessions/:sessionId
```

**Response** `200 OK`
```typescript
{
  success: true
}
```

**Errors**
- `404 Not Found` - Session not found or doesn't belong to user

---

### 5. Update Session Title

Update the title of a session (manual override of auto-generated title).

**Request**
```
PATCH /api/v1/chat/sessions/:sessionId
```

**Body**
```typescript
{
  title: string;
}
```

**Response** `200 OK`
```typescript
{
  session: {
    _id: string;
    userId: string;
    title: string;
    isActive: boolean;
    isTitleGenerated: boolean;
    createdAt: string;
    updatedAt: string;
  }
}
```

---

### 6. Get Session Messages

Get all messages in a session with pagination. Use this to poll for new messages.

**Request**
```
GET /api/v1/chat/sessions/:sessionId/messages
```

**Query Parameters**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 50 | Number of messages to return |
| cursor | string | - | Pagination cursor (message ID) |

**Response** `200 OK`
```typescript
{
  messages: Array<{
    _id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    type: 'text' | 'tool_call' | 'tool_result';
    content: string | null;
    toolCall?: {
      toolCallId: string;
      toolName: string;
      args: Record<string, any>;
    };
    toolResult?: {
      toolCallId: string;
      toolName: string;
      result: any;
    };
    createdAt: string;
  }>;
  cursor?: string;
  hasMore: boolean;
}
```

**Notes**
- After creating a session, poll this endpoint to get the assistant's response
- Stop polling when you get an assistant message with `type: 'text'`

---

### 7. Send Message (Chat Completion)

Send a message to an existing session and get the assistant's response synchronously.
This is NOT streaming - waits for complete response.

**Request**
```
POST /api/v1/chat/sessions/:sessionId/messages
```

**Body**
```typescript
{
  content: string;
}
```

**Response** `200 OK`
```typescript
{
  messages: Array<{
    _id: string;
    sessionId: string;
    role: 'user' | 'assistant';
    type: 'text' | 'tool_call' | 'tool_result';
    content: string | null;
    toolCall?: {
      toolCallId: string;
      toolName: string;
      args: Record<string, any>;
    };
    toolResult?: {
      toolCallId: string;
      toolName: string;
      result: any;
    };
    createdAt: string;
  }>;
}
```

**Notes**
- Unlike session creation, this waits for the full response
- Returns an array of messages because the assistant may invoke tools
- Message order: user message, then any tool calls/results, then final assistant response
- The response includes ALL new messages created during this request

**Errors**
- `400 Bad Request` - Missing or invalid content
- `404 Not Found` - Session not found or doesn't belong to user

---

## Available Tools

The assistant has access to the following tools:

### 1. `getFinancialNews`
Fetches latest financial news.

**Arguments**
```typescript
{
  query?: string;  // Search query (e.g., "AAPL", "crypto", "market")
  limit?: number;  // Number of articles (default: 5)
}
```

**Returns**
```typescript
{
  articles: Array<{
    title: string;
    summary: string;
    source: string;
    publishedAt: string;
    url: string;
  }>;
}
```

---

## Error Response Format

All errors follow this format:

```typescript
{
  message: string;
  code?: string;
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `404` - Not Found
- `500` - Internal Server Error

---

## Typical Frontend Flow

### 1. Start new conversation
```
1. User types first message
2. Call POST /sessions with { content: "user's message" }
3. Response: { session: { _id, isActive: true, isTitleGenerated: false } }
4. Show session in sidebar (with loading state for title)
5. Show user message in chat + loading indicator for assistant
6. Poll GET /sessions/:id/messages every 1-2 seconds
7. When assistant message appears (type: 'text'), stop polling
8. Poll GET /sessions/:id for title update (until isTitleGenerated: true)
```

### 2. Continue conversation (subsequent messages)
```
1. User types message
2. Call POST /sessions/:sessionId/messages with { content: "new message" }
3. Show loading indicator while waiting
4. Response contains all new messages (no polling needed)
5. Append messages to chat
```

### 3. Load existing session
```
1. Call GET /sessions/:sessionId/messages
2. Display all messages in chat
```

### 4. List sessions in sidebar
```
1. Call GET /sessions
2. For sessions with isActive: true, show processing indicator
3. For sessions with isTitleGenerated: false, show "New Chat" or loading
```
