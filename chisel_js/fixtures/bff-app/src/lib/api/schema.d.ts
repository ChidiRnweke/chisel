// Generated from the backend's OpenAPI document. Its presence beside an
// openapi-fetch dependency is what makes detectMode score this tree as a BFF.
export interface paths {
  "/todos": {
    get: { responses: { 200: { content: { "application/json": { id: string }[] } } } };
  };
}
