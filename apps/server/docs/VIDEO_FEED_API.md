# Video Feed API Documentation

## Overview

This API provides an infinite scroll video feed, similar to TikTok or Reels. It supports starting playback from a specific video, filtering content, and seamlessly falling back to a random discovery mode when the specific filtered list is exhausted.

## Endpoint

**GET** `/api/v1/clips/feed`

### Authentication

Requires a valid Bearer token.
`Authorization: Bearer <your_jwt_token>`

## Query Parameters

| Parameter      | Type                     | Required | Description                                                                                                 |
| -------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------- |
| `startVideoId` | string                   | No       | The `clipId` (UUID) of the video to start the feed with. This video will be the first item in the response. |
| `cursor`       | string                   | No       | Pagination cursor (`_id`). Obtained from the `nextCursor` field in the previous response.                   |
| `limit`        | number                   | No       | Number of videos to fetch per request. Default is `10`.                                                     |
| `includeIds`   | string (comma-separated) | No       | List of `clipId`s to explicitly include.                                                                    |
| `excludeIds`   | string (comma-separated) | No       | List of `clipId`s to exclude (e.g., already seen videos).                                                   |
| `categories`   | string (comma-separated) | No       | Filter by category slugs (e.g., `loans,stock-market`).                                                      |
| `tags`         | string (comma-separated) | No       | Filter by tags (e.g., `trending,new`).                                                                      |
| `creatorIds`   | string (comma-separated) | No       | Filter by specific creator IDs.                                                                             |
| `isPremium`    | boolean                  | No       | Filter by premium status (`true` or `false`).                                                               |

## Response Structure

```json
{
  "items": [
    {
      "_id": "65b...",
      "clipId": "uuid-...",
      "title": "How to invest in Stocks",
      "videoUrl": "s3://private-bucket/key...",
      "presignedVideoUrl": "https://bucket.s3.amazonaws.com/key?signature=...",
      "creator": { ... },
      "category": { ... },
      ...
    }
  ],
  "nextCursor": "65b...", // Internal pointer (_id)
  "hasMore": true
}
```

### Key Fields

-   **`items`**: Array of video objects. Each object contains a `clipId` (public ID) and `presignedVideoUrl` for playback.
-   **`nextCursor`**: The internal pointer (`_id`) of the last video. Send this as `cursor` in the next request.
-   **`hasMore`**: Boolean indicating if there are typically more sorted items.

## Logic & Behavior

1.  **Start Video Strategy**:
    If `startVideoId` is provided (and no `cursor`), the API will:

    -   Fetch that specific video first.
    -   Fill the rest of the batch with the next videos in the sorted list (filtered by your criteria).
    -   This allows the user to click "Video B" in a list of [A, B, C] and immediately see B, then scroll down to C.

2.  **Pagination Strategy**:
    If `cursor` is provided:

    -   The API fetches the next set of videos after the cursor ID, adhering to the active filters.

3.  **Random Fallback (Endless Feed)**:
    -   If the filtered list runs out (or if the filters result in few matches), the API automatically fills the remaining `limit` slots with **random videos**.
    -   It ensures these random videos do not duplicate what is currently in the batch.
    -   **Important**: To prevent the same random videos from appearing in subsequent requests, the Frontend **should** accumulate `clipId`s of watched/loaded videos and send them in the `excludeIds` parameter. This ensures a truly unique infinite scroll experience.

## Example Usage (Frontend)

### Scenario: User clicks on a video from the "Stock Market" widget

**Initial Request**:
User clicked on video `vid_123`.

```http
GET /api/v1/clips/feed?startVideoId=vid_123&categories=stock-market&limit=5
```

**Response**:
Returns `[vid_123, vid_124, vid_125, vid_126, vid_127]`. `nextCursor` = `vid_127`.

### Scenario: User scrolls down (Load More)

**Next Request**:
Use `nextCursor` from previous response.

```http
GET /api/v1/clips/feed?cursor=vid_127&categories=stock-market&limit=5
```

**Response**:
Returns `[vid_128, vid_129, random_vid_1, random_vid_2, random_vid_3]`.
_Note: We ran out of stock market videos after `vid_129`, so the API started serving random discovery content._
