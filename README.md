# llms-txt-lint

A zero-dependency validator for [`llms.txt`](https://llmstxt.org) files. Catches malformed headings, broken markdown-link syntax, duplicate titles, and missing recommended sections before you ship the file.

Most existing `llms.txt` tooling *generates* the file. Almost nothing *validates* one you already wrote by hand or generated with another tool — this fills that gap.

## Usage

No install needed — run directly from this repo with `npx`:

```bash
npx github:abyworkings-coder/llms-txt-lint ./llms.txt
npx github:abyworkings-coder/llms-txt-lint https://example.com/llms.txt
```

Exit code is `0` when the file has no errors, `1` when it does — safe to drop into CI.

## What it checks

- Exactly one `# Title` (H1), and it must be the first content in the file
- A blockquote summary (`> ...`) right after the title (warning if missing — recommended, not required, by the spec)
- `## Section` headings only contain well-formed link-list items: `- [name](url): optional notes`
- No headings deeper than H2 (not part of the spec)
- Link text and URLs are non-empty; warns on URLs that aren't absolute or a clear relative path

## GitHub Action

```yaml
- name: Lint llms.txt
  run: npx github:abyworkings-coder/llms-txt-lint ./public/llms.txt
```

## Spec reference

[llmstxt.org](https://llmstxt.org) — this tool tracks that spec; if the spec changes, file an issue.

## License

MIT
