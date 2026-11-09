/**
 * Lightweight inline markdown renderer — no external dependency.
 *
 * Supports: **bold**, *italic*, `inline code`, [links](url),
 * - bullet lists, 1. numbered lists, # headings, > blockquotes,
 * and ```code blocks```.
 *
 * This avoids the need for the react-markdown npm package which
 * caused "Failed to resolve import" errors when users pulled the
 * branch without running npm install first.
 */

/** Render markdown text as React elements. */
export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let list: React.ReactNode[] | null = null;
  let listType: "ul" | "ol" | null = null;
  let codeBlock: string[] | null = null;
  let keyCounter = 0;

  const flushList = () => {
    if (list && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={`list-${keyCounter++}`}>{list}</Tag>
      );
      list = null;
      listType = null;
    }
  };

  const flushCodeBlock = () => {
    if (codeBlock) {
      elements.push(
        <pre key={`code-${keyCounter++}`}>
          <code>{codeBlock.join("\n")}</code>
        </pre>
      );
      codeBlock = null;
    }
  };

  for (const line of lines) {
    // Code block fence
    if (line.trim().startsWith("```")) {
      if (codeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        codeBlock = [];
      }
      continue;
    }
    if (codeBlock) {
      codeBlock.push(line);
      continue;
    }

    // Empty line — flush list
    if (line.trim() === "") {
      flushList();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const content = renderInline(headingMatch[2]);
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      elements.push(<Tag key={`h-${keyCounter++}`}>{content}</Tag>);
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote key={`bq-${keyCounter++}`}>{renderInline(line.slice(2))}</blockquote>
      );
      continue;
    }

    // Bullet list
    if (line.match(/^\s*[-*]\s+/)) {
      if (listType !== "ul") {
        flushList();
        list = [];
        listType = "ul";
      }
      list!.push(<li key={`li-${keyCounter++}`}>{renderInline(line.replace(/^\s*[-*]\s+/, ""))}</li>);
      continue;
    }

    // Numbered list
    if (line.match(/^\s*\d+\.\s+/)) {
      if (listType !== "ol") {
        flushList();
        list = [];
        listType = "ol";
      }
      list!.push(<li key={`li-${keyCounter++}`}>{renderInline(line.replace(/^\s*\d+\.\s+/, ""))}</li>);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(<p key={`p-${keyCounter++}`}>{renderInline(line)}</p>);
  }

  flushList();
  flushCodeBlock();
  return elements;
}

/** Render inline markdown: **bold**, *italic*, `code`, [link](url). */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Pattern matches **bold**, *italic*, `code`, [text](url)
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/;

  while (remaining.length > 0) {
    const match = remaining.match(pattern);
    if (!match) {
      parts.push(remaining);
      break;
    }

    const before = remaining.substring(0, match.index!);
    if (before) parts.push(before);

    if (match[2]) {
      // **bold**
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      parts.push(<code key={key++}>{match[4]}</code>);
    } else if (match[5]) {
      // [text](url)
      parts.push(
        <a key={key++} href={match[6]} target="_blank" rel="noopener noreferrer">
          {match[5]}
        </a>
      );
    }

    remaining = remaining.substring(match.index! + match[0].length);
  }

  return parts;
}
