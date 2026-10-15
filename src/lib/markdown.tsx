import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function inlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-surface px-1 py-0.5 text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        const href = link[2].trim();
        const safe = /^https?:\/\//i.test(href) || href.startsWith("/");
        nodes.push(
          safe ? (
            <a key={key++} href={href} className="font-semibold text-primary underline underline-offset-2" rel={href.startsWith("http") ? "noopener noreferrer" : undefined} target={href.startsWith("http") ? "_blank" : undefined}>
              {link[1]}
            </a>
          ) : (
            <Fragment key={key++}>{link[1]}</Fragment>
          ),
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Lightweight markdown renderer for blog bodies.
 * Supports ATX headings, paragraphs, lists, bold, italic, inline code and links.
 * Raw HTML is rendered as text by React (no dangerouslySetInnerHTML).
 */
export function MarkdownProse({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={cn("space-y-4 text-[15px] leading-7 text-foreground/90", className)}>
      {blocks.map((raw, i) => {
        const b = raw.trim();
        if (!b) return null;
        const heading = /^(#{1,3})\s+(.+)$/.exec(b);
        if (heading && !b.includes("\n")) {
          const level = heading[1].length;
          const Tag = (`h${level}` as "h1" | "h2" | "h3");
          const sizes = { h1: "text-2xl font-bold tracking-tight", h2: "text-xl font-bold tracking-tight", h3: "text-lg font-semibold" };
          return (
            <Tag key={i} className={sizes[Tag]}>
              {inlineMarkdown(heading[2])}
            </Tag>
          );
        }
        const lines = b.split("\n");
        if (lines.every((l) => /^(-|\d+\.)\s/.test(l.trim()))) {
          const ordered = /^\d+\./.test(lines[0].trim());
          const items = lines.map((l) => l.trim().replace(/^(-|\d+\.)\s/, ""));
          const List = ordered ? "ol" : "ul";
          return (
            <List key={i} className={cn("space-y-1 pl-5", ordered ? "list-decimal" : "list-disc")}>
              {items.map((it, j) => (
                <li key={j}>{inlineMarkdown(it)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? "\n" : null}
                {inlineMarkdown(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
