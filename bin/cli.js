#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const LINK_LINE = /^-\s*\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(((?:[^()]|\([^()]*\))*)\)\s*(?::\s*(.*))?$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

function validate(text) {
  const lines = text.split(/\r?\n/);
  const errors = [];
  const warnings = [];

  let h1Count = 0;
  let h1Line = -1;
  let sawNonBlankBeforeH1 = false;
  let inSection = false;
  let sectionHasBlockquoteOrList = false;
  let sawBlockquote = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNo = i + 1;
    if (line === "") continue;

    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();

      if (level === 1) {
        h1Count++;
        if (h1Count > 1) {
          errors.push(`Line ${lineNo}: multiple H1 headings found ("${title}") — only one top-level title is allowed`);
        } else {
          h1Line = lineNo;
        }
        inSection = false;
        continue;
      }

      if (h1Count === 0) {
        errors.push(`Line ${lineNo}: heading "${title}" appears before the required H1 title`);
      }

      if (level === 2) {
        if (inSection && !sectionHasBlockquoteOrList) {
          warnings.push(`Line ${lineNo}: previous section had no link list before this heading`);
        }
        inSection = true;
        sectionHasBlockquoteOrList = false;
        continue;
      }

      warnings.push(`Line ${lineNo}: H${level} heading "${title}" is not part of the llms.txt spec (only H1 for title, H2 for sections)`);
      continue;
    }

    if (h1Count === 0) {
      sawNonBlankBeforeH1 = true;
      continue;
    }

    if (line.startsWith(">")) {
      sawBlockquote = true;
      continue;
    }

    if (inSection) {
      const linkMatch = line.match(LINK_LINE);
      if (linkMatch) {
        const [, text, url] = linkMatch;
        if (!text.trim()) {
          errors.push(`Line ${lineNo}: link has empty text — "${line}"`);
        }
        if (!url.trim()) {
          errors.push(`Line ${lineNo}: link has empty URL — "${line}"`);
        } else if (!/^https?:\/\//.test(url) && !url.startsWith("/") && !url.startsWith(".")) {
          warnings.push(`Line ${lineNo}: URL "${url}" is not absolute (http/https) or a clear relative path`);
        }
        sectionHasBlockquoteOrList = true;
      } else if (line.startsWith("-")) {
        errors.push(`Line ${lineNo}: malformed link-list item, expected "- [name](url): optional notes" — got "${line}"`);
      }
      // free-form prose inside a section is allowed by the spec, so non-list lines are not flagged
      continue;
    }
    // free-form prose after the title/blockquote, before any H2 section — allowed
  }

  if (h1Count === 0) {
    errors.push("No H1 title found — an llms.txt file must start with \"# Project Name\"");
  } else if (sawNonBlankBeforeH1) {
    errors.push("Content found before the H1 title — the title must be the first line");
  }

  if (h1Count >= 1 && !sawBlockquote) {
    warnings.push(`Line ${h1Line}: no blockquote summary ("> ...") found after the title — recommended by the spec`);
  }

  return { errors, warnings };
}

function readInput(source) {
  if (/^https?:\/\//.test(source)) {
    return fetch(source).then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch ${source}: HTTP ${res.status}`);
      }
      return res.text();
    });
  }
  const resolved = path.resolve(process.cwd(), source);
  return Promise.resolve(fs.readFileSync(resolved, "utf8"));
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const jsonMode = rawArgs.includes("--json");
  const args = rawArgs.filter((a) => a !== "--json");

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.log(
      "Usage: llms-txt-lint [--json] <file-or-url>\n" +
        "\n" +
        "Validates an llms.txt file against the llmstxt.org spec.\n" +
        "Examples:\n" +
        "  npx github:abyworkings-coder/llms-txt-lint ./llms.txt\n" +
        "  npx github:abyworkings-coder/llms-txt-lint https://example.com/llms.txt\n" +
        "  npx github:abyworkings-coder/llms-txt-lint --json ./llms.txt\n" +
        "\n" +
        "  --json  emit machine-readable results on stdout instead of text on stderr"
    );
    process.exit(args.length === 0 ? 1 : 0);
  }

  const source = args[0];
  let text;
  try {
    text = await readInput(source);
  } catch (err) {
    if (jsonMode) {
      console.log(JSON.stringify({ source, ok: false, readError: err.message }));
      process.exit(2);
    }
    console.error(`Error reading "${source}": ${err.message}`);
    process.exit(2);
  }

  const { errors, warnings } = validate(text);

  if (jsonMode) {
    console.log(
      JSON.stringify({ source, ok: errors.length === 0, errors, warnings })
    );
    process.exit(errors.length > 0 ? 1 : 0);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`✓ ${source} is a valid llms.txt file`);
    process.exit(0);
  }

  for (const e of errors) console.error(`error   ${e}`);
  for (const w of warnings) console.error(`warning ${w}`);

  console.log(
    `\n${errors.length} error(s), ${warnings.length} warning(s) in ${source}`
  );
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
