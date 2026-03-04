# Experts API Documentation

Base URL: `/api/v1/experts`

All endpoints require authentication.

---

## Endpoints

### 1. List Experts

Retrieves a paginated list of experts with optional filtering.

**Request**

```
GET /api/v1/experts/list
```

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `filter[includeIds]` | string[] | Optional. List of expert IDs to include. |
| `filter[excludeIds]` | string[] | Optional. List of expert IDs to exclude. |
| `filter[allowAIChat]` | boolean | Optional. Filter by experts allowing AI chat. |
| `filter[allowDirectChat]` | boolean | Optional. Filter by experts allowing direct chat. |
| `limit` | number | Optional. Number of experts to return (default: 20). |
| `cursor` | string | Optional. Pagination cursor (expert ID). |

**Response** `200 OK`

```typescript
{
  items: Expert[];
  nextCursor?: string;
  hasMore: boolean;
}
```

---

### 2. Get Expert Details

Retrieves details for a specific expert.

**Request**

```
GET /api/v1/experts/:id
```

**Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | The Expert's ID (expertId, not \_id). |

**Response** `200 OK`

```typescript
// Returns the Expert object
{
    _id: string;
    expertId: string;
    name: string;
    // ... other expert fields
    aiPersona: {
        systemPrompt: string;
        // ...
    }
}
```

---

### 3. Get Chat Messages (Reverse Pagination)

Retrieves chat history with a specific expert. Supports reverse pagination to load older messages.

**Request**

```
GET /api/v1/experts/:id/messages
```

**Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | The Expert's ID. |

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Optional. Number of messages to return (default: 20). |
| `lastMessageId` | string | Optional. The ID of the oldest message currently loaded on the client. Used to fetch the _previous_ page of messages (older than this ID). |

**Pagination Logic**

-   **First Load**: Call without `lastMessageId` to get the latest 20 messages.
-   **Load More (Scroll Up)**: Pass the `_id` of the top-most (oldest) message currently displayed as `lastMessageId`.
-   **Order**: The API returns messages sorted **chronologically** (Oldest -> Newest), suitable for direct display in the chat UI.

**Response** `200 OK`

```typescript
{
    messages: Array<{
        _id: string;
        expertId: string;
        userId: string;
        role: 'user' | 'assistant';
        type: 'text' | 'tool_call' | 'tool_result';
        content: string;
        createdAt: string;
        // ...
    }>;
    hasMore: boolean; // True if there are even older messages available
}
```

---

### 4. Send Message to Expert (AI Personal)

Sends a message to the expert AI persona and receives a generated response.

**Request**

```
POST /api/v1/experts/:id/message
```

**Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | The Expert's ID. |

**Body**

```typescript
{
    content: string; // The user's message text
}
```

**Response** `200 OK`

```typescript
// Returns the Assistant's response message object
{
    _id: string;
    expertId: string;
    userId: string;
    messageId: string;
    role: 'assistant';
    type: 'text';
    content: string; // The AI's response text
    createdAt: string;
    // ...
}
```

**Notes**

-   This endpoint is synchronous and waits for the AI to generate a text response.
-   Currently supports text-only responses.

---

## Data Models

### Expert

```typescript
interface Expert {
    _id: string;
    expertId: string;
    name: string;
    slug: string;
    tagline: string;
    description: string;
    avatarUrl: string;
    bannerUrl: string;
    featured: boolean;
    featuredOrder: number;
    status: 'active' | 'inactive';
    allowAIChat: boolean;
    allowDirectChat: boolean;
    aiPersona: {
        name: string;
        systemPrompt: string;
        tone: string;
    };
    // ... other fields
}
```

### ExpertAIChatMessage

```typescript
interface ExpertAIChatMessage {
    _id: string;
    expertId: string;
    userId: string;
    messageId: string;
    role: 'user' | 'assistant';
    type: 'text' | 'tool_call' | 'tool_result';
    content: string;
    toolCall?: any;
    toolResult?: any;
    createdAt: string;
    updatedAt: string;
}
```
