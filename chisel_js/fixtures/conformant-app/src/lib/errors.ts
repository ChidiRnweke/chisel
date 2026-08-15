/** The base every domain failure extends, so hooks.server.ts can map one type. */
export class DomainError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION");
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}
