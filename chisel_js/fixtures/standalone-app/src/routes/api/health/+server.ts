import { json } from "@sveltejs/kit";

// Correct: the status is bound to the response via json(). Spanning lines must
// not defeat the exemption.
export const GET = () =>
  json(
    { ok: true },
    {
      status: 200,
    },
  );
