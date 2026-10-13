import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { requestHoldsAccountChoice } from "@/lib/account-choice";

function withoutForcedSignIn(request: Request): Request {
  if (!requestHoldsAccountChoice(request.headers.get("cookie"))) return request;
  if (!request.headers.has("x-grok-identity")) return request;
  const headers = new Headers(request.headers);
  headers.delete("x-grok-identity");
  return new Request(request, { headers });
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(withoutForcedSignIn(request)),
      POST: ({ request }) => auth.handler(withoutForcedSignIn(request)),
    },
  },
});
