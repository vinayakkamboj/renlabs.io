"use client";

/**
 * Safe markdown renderer for README files in imported repos.
 *
 * Parses markdown line-by-line into React elements. No dangerouslySetInnerHTML —
 * all content is text-escaped by React, so this is XSS-safe even with untrusted
 * GitHub README content.
 */

import { useMemo } from "react";

// ── Block types ───────────────────────────────────────────────────────────────

type Block =
  | { type: "h1" | "h2" | "h3" | "h4"; text: string }
  | { type: "code"; lang: string; lines: string[] }
  | { type: "blockquote"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "p"; text: string }
  | { type: "blank" };

// ── Inline formatter ──────────────────────────────────────────────────────────

function InlineParts({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let k = 0;

  while (rest.length > 0) {
    const bold = rest.match(/^\*\*(.*?)\*\*/);
    if (bold) {
      parts.push(<strong key={k++} className="font-semibold text-dusk">{bold[1]}</strong>);
      rest = rest.slice(bold[0].length);
      continue;
    }
    const italic = rest.match(/^\*(.*?)\*/);
    if (italic) {
      parts.push(<em key={k++}>{italic[1]}</em>);
      rest = rest.slice(italic[0].length);
      continue;
    }
    const code = rest.match(/^`([^`\n]+)`/);
    if (code) {
      parts.push(
        <code key={k++} className="rounded bg-carbon-high px-1 py-0.5 font-mono text-[11.5px] text-brass">
          {code[1]}
        </code>,
      );
      rest = rest.slice(code[0].length);
      continue;
    }
    const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      parts.push(
        <a
          key={k++}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brass underline underline-offset-2 hover:no-underline"
        >
          {link[1]}
        </a>,
      );
      rest = rest.slice(link[0].length);
      continue;
    }
    // Find next special char; emit plain text up to it.
    const next = rest.search(/\*\*|\*|`|\[/);
    if (next === -1) { parts.push(rest); break; }
    if (next > 0) { parts.push(rest.slice(0, next)); rest = rest.slice(next); }
    else { parts.push(rest[0]); rest = rest.slice(1); } // stuck — consume one
  }

  return <>{parts}</>;
}

// ── Block parser ─────────────────────────────────────────────────────────────

function parseMarkdown(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", lang, lines: codeLines });
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("#### ")) {
      blocks.push({ type: "h4", text: line.slice(5) });
    } else if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2) });
    }
    // Horizontal rule
    else if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push({ type: "hr" });
    }
    // Blockquote
    else if (line.startsWith("> ")) {
      blocks.push({ type: "blockquote", text: line.slice(2) });
    }
    // Unordered list
    else if (/^[-*+] /.test(line)) {
      const items = [line.slice(2)];
      i++;
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    // Ordered list
    else if (/^\d+\. /.test(line)) {
      const items = [line.replace(/^\d+\. /, "")];
      i++;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    // Blank line
    else if (line.trim() === "") {
      blocks.push({ type: "blank" });
    }
    // Paragraph — merge continuation lines
    else {
      const pLines = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].startsWith("#") &&
        !lines[i].startsWith("```") &&
        !lines[i].startsWith(">") &&
        !/^[-*+] /.test(lines[i]) &&
        !/^\d+\. /.test(lines[i]) &&
        !/^(---+|\*\*\*+|___+)\s*$/.test(lines[i])
      ) {
        pLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "p", text: pLines.join(" ") });
      continue;
    }

    i++;
  }

  return blocks;
}

// ── Main component ────────────────────────────────────────────────────────────

interface ReadmeViewerProps {
  content: string;
  /** Show a subtle "preview unavailable" notice above the README. */
  previewUnavailableReason?: string;
}

export function ReadmeViewer({ content, previewUnavailableReason }: ReadmeViewerProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="h-full overflow-y-auto bg-carbon">
      {previewUnavailableReason && (
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-carbon-line bg-carbon-raised/95 px-5 py-2 backdrop-blur">
          <span className="text-[11.5px] text-dusk-faint">{previewUnavailableReason}</span>
          <span className="text-[11px] text-dusk-faint/60">
            · Use the chat to read, edit, or run this project
          </span>
        </div>
      )}
      <div className="mx-auto max-w-3xl px-8 py-6">
        {blocks.map((block, idx) => {
          switch (block.type) {
            case "h1":
              return (
                <h1 key={idx} className="mb-4 mt-8 text-[22px] font-bold text-dusk first:mt-0">
                  <InlineParts text={block.text} />
                </h1>
              );
            case "h2":
              return (
                <h2 key={idx} className="mb-3 mt-6 border-b border-carbon-line pb-1.5 text-[17px] font-semibold text-dusk">
                  <InlineParts text={block.text} />
                </h2>
              );
            case "h3":
              return (
                <h3 key={idx} className="mb-2 mt-5 text-[14px] font-semibold text-dusk">
                  <InlineParts text={block.text} />
                </h3>
              );
            case "h4":
              return (
                <h4 key={idx} className="mb-2 mt-4 text-[13px] font-semibold text-dusk-muted">
                  <InlineParts text={block.text} />
                </h4>
              );
            case "code":
              return (
                <pre
                  key={idx}
                  className="mb-4 overflow-x-auto rounded-lg border border-carbon-line bg-carbon-raised px-4 py-3 font-mono text-[11.5px] leading-relaxed text-dusk-muted"
                >
                  {block.lines.join("\n")}
                </pre>
              );
            case "blockquote":
              return (
                <blockquote key={idx} className="mb-3 border-l-2 border-brass/40 pl-4 italic text-[13px] text-dusk-muted">
                  <InlineParts text={block.text} />
                </blockquote>
              );
            case "ul":
              return (
                <ul key={idx} className="mb-3 space-y-1 pl-1">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-[13px] text-dusk-muted">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brass/50" />
                      <InlineParts text={item} />
                    </li>
                  ))}
                </ul>
              );
            case "ol":
              return (
                <ol key={idx} className="mb-3 space-y-1 pl-1">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-[13px] text-dusk-muted">
                      <span className="mt-0.5 shrink-0 font-mono text-[11px] text-brass/70">{j + 1}.</span>
                      <InlineParts text={item} />
                    </li>
                  ))}
                </ol>
              );
            case "hr":
              return <hr key={idx} className="my-6 border-carbon-line" />;
            case "blank":
              return <div key={idx} className="h-2" />;
            case "p":
              return (
                <p key={idx} className="mb-3 text-[13px] leading-relaxed text-dusk-muted">
                  <InlineParts text={block.text} />
                </p>
              );
          }
        })}
      </div>
    </div>
  );
}
