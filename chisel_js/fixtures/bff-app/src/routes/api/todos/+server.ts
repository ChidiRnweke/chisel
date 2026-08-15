import type { RequestHandler } from "@sveltejs/kit";

// CORRECT: a BFF's job is to be an HTTP surface for its own frontend, so a
// handler under src/routes/api/ is exactly where it belongs. Note also that
// route-style:prefer-remote-function must stay silent across this whole tree —
// a BFF has no remote functions to prefer over an API route.
export const GET: RequestHandler = async () => {
  return new Response("[]", { headers: { "content-type": "application/json" } });
};
