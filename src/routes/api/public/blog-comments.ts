import { createFileRoute } from "@tanstack/react-router";
import { submitComment } from "@/server/wordpress-blog";
import type { BlogCommentInput } from "@/content/blog";

/**
 * Submitting a comment only ever happens from a browser form, never during
 * SSR, so — unlike the read paths — this needs a real endpoint rather than
 * createServerOnlyFn (which throws if called client-side by design).
 */
export const Route = createFileRoute("/api/public/blog-comments")({
  server: {
    handlers: {
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
