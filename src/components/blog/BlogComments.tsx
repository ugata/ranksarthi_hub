import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/date";
import { blogDataProvider } from "@/content/blog";
import type { BlogComment } from "@/content/blog";

function CommentItem({ comment }: { comment: BlogComment }) {
  const date = formatDate(comment.publishedAt);
  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-4">
      {comment.avatarUrl ? (
        <img src={comment.avatarUrl} alt="" className="size-9 shrink-0 rounded-full" width={36} height={36} />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
          {comment.authorName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="font-semibold text-primary">{comment.authorName}</p>
          {date ? <time dateTime={comment.publishedAt} className="text-xs text-muted-foreground">{date}</time> : null}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{comment.content}</p>
      </div>
    </li>
  );
}

export function BlogComments({ articleId, initialComments }: { articleId: string; initialComments: BlogComment[] }) {
  const [comments] = useState(initialComments);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await blogDataProvider.submitComment({ postId: articleId, authorName: name, authorEmail: email, content });
    setSubmitting(false);
    if (res.ok) {
      setResult({ ok: true, message: "Thanks — your comment is awaiting moderation and will appear once approved." });
      setName("");
      setEmail("");
      setContent("");
    } else {
      setResult({ ok: false, message: res.reason });
    }
  };

  return (
    <section className="mx-auto mt-16 max-w-3xl">
      <h2 className="text-display-md text-primary">
        Comments{comments.length ? ` (${comments.length})` : ""}
      </h2>

      {comments.length ? (
        <ul className="mt-6 space-y-4">
          {comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No comments yet — be the first to share your thoughts.</p>
      )}

      <form onSubmit={onSubmit} className="mt-8 rounded-xl border border-border bg-ivory p-6">
        <h3 className="text-lg font-bold text-primary">Leave a comment</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="comment-name">Name</Label>
            <Input id="comment-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="comment-email">Email (not published)</Label>
            <Input id="comment-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="comment-content">Comment</Label>
          <Textarea id="comment-content" required rows={4} value={content} onChange={(e) => setContent(e.target.value)} className="mt-1.5" />
        </div>
        {result ? (
          <p className={`mt-4 text-sm ${result.ok ? "text-emerald-700" : "text-destructive"}`}>{result.message}</p>
        ) : null}
        <Button type="submit" disabled={submitting} className="mt-4">
          {submitting ? "Posting…" : "Post comment"}
        </Button>
      </form>
    </section>
  );
}
