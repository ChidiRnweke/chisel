// Legitimately HTTP: the identity provider chose this URL.
export const GET = () => new Response(null, { status: 302 });
