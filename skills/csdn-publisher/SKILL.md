---
name: csdn-publisher
description: Use this skill when you need to publish a Markdown article to CSDN through this project's HTTP publisher service, whether the endpoint is local or exposed to the public internet. It covers session checks, payload construction, optional category/tag handling, and the preferred helper script for reliable publishing.
---

# CSDN Publisher

Use this skill when the task is "publish a Markdown article to CSDN with the repo's API service".

## What to use

- Prefer `scripts/publish_article.py` in this skill folder.
- The script reads a Markdown file, derives a title and summary when needed, and calls the publish API.
- The endpoint defaults to `http://localhost:3001/api/csdn/publish`, but can be overridden for a public deployment.

## Fast path

1. Confirm the service is reachable.
2. If the endpoint is local, optionally check `GET /api/csdn/session` to verify `loggedIn=true`.
3. Run:

```bash
python3 skills/csdn-publisher/scripts/publish_article.py /absolute/path/to/article.md
```

4. Add `--category` only when the account should publish into a single existing CSDN column.
5. Add `--endpoint` when the service has been exposed behind a public URL.

## Preferred usage patterns

Publish without a category:

```bash
python3 skills/csdn-publisher/scripts/publish_article.py /path/article.md
```

Publish with a category:

```bash
python3 skills/csdn-publisher/scripts/publish_article.py /path/article.md \
  --category 树莓派
```

Publish to a public endpoint:

```bash
python3 skills/csdn-publisher/scripts/publish_article.py /path/article.md \
  --endpoint https://your-domain.example/api/csdn/publish
```

## Behavior rules

- `title`: defaults to the first Markdown H1.
- `summary`: defaults to the first non-heading, non-code paragraph.
- `tags`: optional; pass explicit tags when the article has a clear topic.
- `category`: optional; omit it for accounts that do not have columns.
- If `CSDN_PUBLISHER_TOKEN` is set, the helper script sends `Authorization: Bearer <token>`. This is useful when the endpoint is later protected by a gateway or reverse proxy.

## Failure handling

- If the API returns a non-2xx response, surface the full body.
- If the response has `ok=false`, treat the publish as failed.
- If the session endpoint says `loggedIn=false`, stop and ask the user to log in through the browser/noVNC flow before retrying.
