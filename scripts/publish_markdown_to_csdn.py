#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_ENDPOINT = "http://localhost:3001/api/csdn/publish"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read a Markdown file and publish it to the local CSDN publisher API.",
    )
    parser.add_argument("markdown_file", help="Absolute or relative path to the markdown file")
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=f"Publisher API endpoint, default: {DEFAULT_ENDPOINT}",
    )
    parser.add_argument("--category", required=True, help="Single CSDN category/column name")
    parser.add_argument(
        "--tags",
        nargs="*",
        default=["MSP430G2553", "单片机", "嵌入式"],
        help="Optional tags to submit with the article",
    )
    parser.add_argument("--title", help="Optional explicit title; defaults to first H1 in the file")
    parser.add_argument(
        "--summary",
        help="Optional explicit summary; defaults to the first non-heading paragraph",
    )
    parser.add_argument(
        "--close-browser-after-publish",
        action="store_true",
        help="Close the persistent browser session after publishing",
    )
    return parser.parse_args()


def extract_title(markdown: str, fallback: str) -> str:
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def extract_summary(markdown: str) -> str:
    blocks = [block.strip() for block in markdown.split("\n\n")]
    for block in blocks:
        if not block:
            continue
        if block.startswith("#"):
            continue
        if block.startswith("```"):
            continue
        compact = " ".join(line.strip() for line in block.splitlines()).strip()
        if compact.startswith("建议文件名："):
            continue
        if compact:
            return compact[:180]
    return "通过本地接口自动发布到 CSDN 的 Markdown 文章。"


def unique_items(items: Iterable[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        value = item.strip()
        if value and value not in result:
            result.append(value)
    return result


def publish(endpoint: str, payload: dict) -> dict:
    request = Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    args = parse_args()
    markdown_path = Path(args.markdown_file).expanduser().resolve()

    if not markdown_path.is_file():
        print(f"Markdown file not found: {markdown_path}", file=sys.stderr)
        return 1

    markdown = markdown_path.read_text(encoding="utf-8")
    title = args.title or extract_title(markdown, markdown_path.stem)
    summary = args.summary or extract_summary(markdown)

    payload = {
      "title": title,
      "markdown": markdown,
      "tags": unique_items(args.tags),
      "category": args.category,
      "summary": summary,
      "closeBrowserAfterPublish": args.close_browser_after_publish,
    }

    print("Publishing article with payload:")
    print(json.dumps(
        {
            "title": payload["title"],
            "category": payload["category"],
            "tags": payload["tags"],
            "summary": payload["summary"],
            "markdown_file": str(markdown_path),
            "endpoint": args.endpoint,
        },
        ensure_ascii=False,
        indent=2,
    ))

    try:
        response = publish(args.endpoint, payload)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"Publish failed with HTTP {error.code}:", file=sys.stderr)
        print(body, file=sys.stderr)
        return 1
    except URLError as error:
        print(f"Unable to reach publisher API: {error}", file=sys.stderr)
        return 1

    print("\nPublish response:")
    print(json.dumps(response, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
