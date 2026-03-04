#!/usr/bin/env python3
"""Fetch YouTube transcript using youtube-transcript-api (Python).
Called from Node.js as a subprocess.

Usage: python3 fetch-transcript.py <video_id> [lang1,lang2,...] [scraper_api_key]
Output: JSON array of {text, offset, duration} or "null" on failure.
Exits with code 2 on IP block (rate limit) so caller can retry.
"""
import sys
import json
import time

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds


def build_client(api_key=None):
    from youtube_transcript_api import YouTubeTranscriptApi

    if api_key:
        from youtube_transcript_api.proxies import GenericProxyConfig
        proxy_url = f"http://scraperapi:{api_key}@proxy-server.scraperapi.com:8001"
        proxy = GenericProxyConfig(https_url=proxy_url)
        return YouTubeTranscriptApi(proxy_config=proxy)

    return YouTubeTranscriptApi()


def fetch(video_id, languages, api_key=None):
    from youtube_transcript_api._errors import IpBlocked, RequestBlocked

    for attempt in range(MAX_RETRIES):
        ytt = build_client(api_key)
        try:
            transcript = ytt.fetch(video_id, languages=languages)
            return [
                {"text": s.text, "offset": s.start, "duration": s.duration}
                for s in transcript.snippets
            ]
        except (IpBlocked, RequestBlocked):
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_DELAY * (attempt + 1)
                print(f"Rate limited, retrying in {wait}s (attempt {attempt + 2}/{MAX_RETRIES})...", file=sys.stderr)
                time.sleep(wait)
            else:
                print(f"Rate limited after {MAX_RETRIES} attempts", file=sys.stderr)
                sys.exit(2)
        except Exception:
            break

    # Fallback: pick first available transcript
    try:
        ytt = build_client(api_key)
        for t in ytt.list(video_id):
            transcript = t.fetch()
            return [
                {"text": s.text, "offset": s.start, "duration": s.duration}
                for s in transcript.snippets
            ]
    except Exception:
        pass

    return None


def main():
    if len(sys.argv) < 2:
        print("null")
        sys.exit(0)

    video_id = sys.argv[1]
    languages = sys.argv[2].split(",") if len(sys.argv) > 2 else ["hi", "en"]
    api_key = sys.argv[3] if len(sys.argv) > 3 else None

    result = fetch(video_id, languages, api_key)
    if result:
        print(json.dumps(result))
    else:
        print("null")


if __name__ == "__main__":
    main()
