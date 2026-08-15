// ANTI-PATTERN: a request handler outside src/routes/api/. The API tree is the
// contract; a handler hiding beside a page is an endpoint nobody discovers.
export const GET = async () => {
  return new Response("[]");
};
