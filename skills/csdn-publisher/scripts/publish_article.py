#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = os.environ.get("CSDN_PUBLISHER_BASE_URL", "http://localhost:3001")
DEFAULT_ENDPOINT = os.environ.get(
    "CSDN_PUBLISHER_ENDPOINT",
    f"{DEFAULT_BASE_URL.rstrip('/')}/api/csdn/publish",
)
DEFAULT_TOKEN = os.environ.get("CSDN_PUBLISHER_TOKEN")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Publish a Markdown article through the CSDN publisher API.",
    )
    parser.add_argument("markdown_file", help="Absolute or relative path to a Markdown file")
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=f"Publish API endpoint, default: {DEFAULT_ENDPOINT}",
    )
    parser.add_argument(
        "--session-endpoint",
        default=None,
        help="Optional session endpoint. Defaults to <base>/api/csdn/session when the publish endpoint ends with /api/csdn/publish.",
    )
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="Optional bearer token")
    parser.add_argument("--category", help="Optional single CSDN category/column name")
    parser.add_argument(
        "--tags",
        nargs="*",
        default=[],
        help="Optional tags. Example: --tags MSP430G2553 单片机 嵌入式",
    )
    parser.add_argument("--title", help="Optional explicit title; defaults to the first H1")
    parser.add_argument(
        "--summary",
        help="Optional explicit summary; defaults to the first non-heading paragraph",
    )
    parser.add_argument(
        "--skip-session-check",
        action="store_true",
        help="Skip querying the session endpoint before publishing",
    )
    parser.add_argument(
        "--close-browser-after-publish",
        action="store_true",
        help="Request the service to close the persistent browser session after publishing",
    )
    return parser.parse_args()


def derive_session_endpoint(publish_endpoint: str, explicit: str | None) -> str | None:
    if explicit:
        return explicit
    suffix = "/api/csdn/publish"
    if publish_endpoint.endswith(suffix):
        return f"{publish_endpoint[:-len(suffix)]}/api/csdn/session"
    return None


def extract_title(markdown: str, fallback: str) -> str:
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def extract_summary(markdown: str) -> str:
    for block in (block.strip() for block in markdown.split("\n\n")):
        if not block or block.startswith("#") or block.startswith("```"):
            continue
        compact = " ".join(line.strip() for line in block.splitlines()).strip()
        if not compact or compact.startswith("建议文件名："):
            continue
        return compact[:180]
    return "通过 CSDN 发布接口自动生成的 Markdown 文章。"


def unique_items(items: Iterable[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        normalized = item.strip()
        if normalized and normalized not in result:
            result.append(normalized)
    return result


def build_headers(token: str | None) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def request_json(url: str, method: str, payload: dict | None, token: str | None) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(url, data=data, headers=build_headers(token), method=method)
    with urlopen(request, timeout=240) as response:
        return json.loads(response.read().decode("utf-8"))


def check_session(session_endpoint: str | None, token: str | None) -> None:
    if not session_endpoint:
        return

    data = request_json(session_endpoint, "GET", None, token)
    if not data.get("browserOpen"):
        raise RuntimeError(f"Browser session is not open: {json.dumps(data, ensure_ascii=False)}")
    if not data.get("loggedIn"):
        raise RuntimeError(f"CSDN is not logged in: {json.dumps(data, ensure_ascii=False)}")


def main() -> int:
    args = parse_args()
    markdown_path = Path(args.markdown_file).expanduser().resolve()

    if not markdown_path.is_file():
        print(f"Markdown file not found: {markdown_path}", file=sys.stderr)
        return 1

    markdown = markdown_path.read_text(encoding="utf-8")
    title = args.title or extract_title(markdown, markdown_path.stem)
    summary = args.summary or extract_summary(markdown)
    tags = unique_items(args.tags)

    payload = {
        "title": title,
        "markdown": markdown,
        "summary": summary,
        "closeBrowserAfterPublish": args.close_browser_after_publish,
    }
    if tags:
        payload["tags"] = tags
    if args.category:
        payload["category"] = args.category.strip()

    session_endpoint = derive_session_endpoint(args.endpoint, args.session_endpoint)

    print(
        json.dumps(
            {
                "markdown_file": str(markdown_path),
                "endpoint": args.endpoint,
                "session_endpoint": session_endpoint,
                "title": title,
                "category": args.category,
                "tags": tags,
                "summary": summary,
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    try:
        if not args.skip_session_check:
            check_session(session_endpoint, args.token)

        response = request_json(args.endpoint, "POST", payload, args.token)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"Publish failed with HTTP {error.code}:", file=sys.stderr)
        print(body, file=sys.stderr)
        return 1
    except URLError as error:
        print(f"Unable to reach publisher API: {error}", file=sys.stderr)
        return 1
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1

    print(json.dumps(response, ensure_ascii=False, indent=2))
    if response.get("ok") is not True:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
