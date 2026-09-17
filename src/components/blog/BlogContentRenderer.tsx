import { Link } from "@tanstack/react-router";
import { isSafeExternalHref } from "@/lib/utils";
import type { BlogContentNode, BlogInline } from "@/content/blog";

function Inline({ nodes }: { nodes: BlogInline[] }) {
  return nodes.map((node, index) => {
    let content: React.ReactNode = node.text;
    if (node.bold) content = <strong className="font-semibold text-primary">{content}</strong>;
    if (node.italic) content = <em>{content}</em>;
    if (node.underline) content = <u>{content}</u>;
    if (node.strikethrough) content = <s>{content}</s>;
    if (node.code) content = <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.9em] text-primary">{content}</code>;
    if (node.href) {
      content = node.href.startsWith("/") ? (
        <Link to={node.href} className="font-medium text-accent underline underline-offset-4 hover:text-red-hover">
          {content}
        </Link>
      ) : isSafeExternalHref(node.href) ? (
        <a href={node.href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-4 hover:text-red-hover">
          {content}
        </a>
      ) : (
        content
      );
    }
    const style = node.color || node.backgroundColor ? { color: node.color, backgroundColor: node.backgroundColor } : undefined;
    return (
      <span key={`${index}-${node.text}`} style={style}>
        {content}
      </span>
    );
  });
}

export function BlogContentRenderer({ content }: { content: BlogContentNode[] }) {
  return (
    <div className="min-w-0 space-y-6 text-base leading-relaxed text-ink/85">
      {content.map((node, index) => {
        if (node.type === "heading") {
          const Tag = `h${node.level}` as const;
          const sizeByLevel: Record<typeof node.level, string> = {
            2: "pt-5 text-2xl",
            3: "pt-2 text-xl",
            4: "pt-2 text-lg",
            5: "pt-1 text-base",
            6: "pt-1 text-sm uppercase tracking-wide",
          };
          return (
            <Tag
              key={node.id}
              id={node.id}
              style={node.align ? { textAlign: node.align } : undefined}
              className={`${sizeByLevel[node.level]} scroll-mt-28 font-bold text-primary`}
            >
              {node.text}
            </Tag>
          );
        }
        if (node.type === "paragraph")
          return (
            <p key={index} style={node.align ? { textAlign: node.align } : undefined}>
              <Inline nodes={node.children} />
            </p>
          );
        if (node.type === "list") {
          const Tag = node.ordered ? "ol" : "ul";
          return <Tag key={index} className={`space-y-2 pl-6 ${node.ordered ? "list-decimal" : "list-disc"} marker:text-accent`}>{node.items.map((item, itemIndex) => <li key={itemIndex}><Inline nodes={item} /></li>)}</Tag>;
        }
        if (node.type === "blockquote") return <blockquote key={index} className="border-l-4 border-gold bg-ivory px-5 py-4 text-lg font-medium text-primary"><Inline nodes={node.children} /></blockquote>;
        if (node.type === "table") return (
          <div key={index} className="max-w-full overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
              {node.caption ? <caption className="bg-ivory px-4 py-3 text-left font-semibold text-primary">{node.caption}</caption> : null}
              <thead className="bg-secondary text-primary"><tr>{node.columns.map((column) => <th key={column} scope="col" className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead>
              <tbody>{node.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-border">{row.map((cell, cellIndex) => <td key={cellIndex} className="break-words px-4 py-3">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
        if (node.type === "image") return <figure key={index}><img src={node.src} alt={node.alt} loading="lazy" className="w-full rounded-xl object-cover" />{node.caption ? <figcaption className="mt-2 text-sm text-muted-foreground">{node.caption}</figcaption> : null}</figure>;
        if (node.type === "code")
          return (
            <pre key={index} className="overflow-x-auto rounded-lg bg-navy-deep p-4 text-sm text-primary-foreground">
              <code className={node.language ? `language-${node.language}` : undefined}>{node.code}</code>
            </pre>
          );
        if (node.type === "separator") return <hr key={index} className="border-border" />;
        if (node.type === "callout") return <aside key={index} className={`rounded-lg border px-5 py-4 ${node.tone === "caution" ? "border-warning/30 bg-warning/10" : "border-border bg-ice"}`}>{node.title ? <p className="mb-1 font-semibold text-primary">{node.title}</p> : null}<p><Inline nodes={node.children} /></p></aside>;
        return null;
      })}
    </div>
  );
}