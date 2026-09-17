import { createFileRoute } from "@tanstack/react-router";
import { fetchComments, submitComment } from "@/server/wordpress-blog";
import type { BlogCommentInput } from "@/content/blog";

/**
 * Real endpoint rather than createServerOnlyFn for both handlers: comment
 * submission only ever happens from a browser form, and comment listing is
 * read by a route loader that can re-run client-side during a SPA
 * navigation — createServerOnlyFn throws in either case when called outside
 * a server request context.
 */
export const Route = createFileRoute("/api/public/blog-comments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const postId = url.searchParams.get("postId");
        if (!postId) return Response.json({ error: "Missing postId." }, { status: 400 });
        const comments = await fetchComments(postId);
        return Response.json(comments);
      },
      POST: async ({ request }) => {
        let body: Partial<BlogCommentInput>;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, reason: "Invalid request." }, { status: 400 });
        }
        if (
          typeof body.postId !== "string" ||
          typeof body.authorName !== "string" ||
          typeof body.authorEmail !== "string" ||
          typeof body.content !== "string"
        ) {
          return Response.json({ ok: false, reason: "Missing required fields." }, { status: 400 });
        }
        const result = await submitComment({
          postId: body.postId,
          authorName: body.authorName,
          authorEmail: body.authorEmail,
          content: body.content,
          ...(typeof body.parentId === "string" ? { parentId: body.parentId } : {}),
        });
        return Response.json(result, { status: result.ok ? 201 : 400 });
      },
    },
  },
});
