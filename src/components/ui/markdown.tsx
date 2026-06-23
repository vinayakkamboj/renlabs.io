"use client";

import { cn } from "@/lib/utils";

function InlineContent({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={i} className="font-semibold text-dusk">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={i}
              className="rounded bg-carbon-high px-1.5 py-0.5 font-mono text-[0.85em] text-brass"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function MarkdownContent({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
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
      i++;
      nodes.push(
        <div
          key={`cb-${i}`}
          className="my-2 overflow-hidden rounded-xl border border-carbon-line"
        >
          {lang && (
            <div className="border-b border-carbon-line bg-carbon px-3 py-1.5">
              <span className="font-mono text-[10px] text-dusk-faint">{lang}</span>
            </div>
          )}
          <pre className="platform-scroll overflow-x-auto bg-carbon-raised p-3">
            <code className="font-mono text-[12px] leading-relaxed text-dusk">
              {codeLines.join("\n")}
            </code>
          </pre>
        </div>,
      );
      continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const lvl = hMatch[1].length;
      const cls =
        lvl === 1
          ? "text-[14.5px] font-semibold text-dusk mt-4 mb-1 first:mt-0"
          : lvl === 2
            ? "text-[13.5px] font-semibold text-dusk mt-3 mb-0.5 first:mt-0"
            : "text-[13px] font-medium text-dusk mt-2 first:mt-0";
      nodes.push(
        <p key={i} className={cls}>
          <InlineContent text={hMatch[2]} />
        </p>,
      );
      i++;
      continue;
    }

    // Bullet list item
    if (/^[-*]\s/.test(line)) {
      nodes.push(
        <div key={i} className="flex gap-2.5 leading-relaxed">
          <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-dusk-faint/50" />
          <span className="flex-1">
            <InlineContent text={line.replace(/^[-*]\s/, "")} />
          </span>
        </div>,
      );
      i++;
      continue;
    }

    // Numbered list item
    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      nodes.push(
        <div key={i} className="flex gap-2 leading-relaxed">
          <span className="shrink-0 font-mono text-[11px] text-dusk-faint tabular-nums">
            {numMatch[1]}.
          </span>
          <span className="flex-1">
            <InlineContent text={numMatch[2]} />
          </span>
        </div>,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(
        <div key={i} className="my-3 border-t border-carbon-line" />,
      );
      i++;
      continue;
    }

    // Blank line
    if (!line.trim()) {
      nodes.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }

    // Normal paragraph
    nodes.push(
      <p key={i} className="leading-relaxed">
        <InlineContent text={line} />
      </p>,
    );
    i++;
  }

  return (
    <div className={cn("text-[13.5px] text-dusk-muted", className)}>
      {nodes}
    </div>
  );
}
