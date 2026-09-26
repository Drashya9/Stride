export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export class Unauthorized extends AppError {
  constructor(message = "Sign in required") {
    super(401, "unauthorized", message);
  }
}

export class Forbidden extends AppError {
  constructor(message = "You don't have permission to do that") {
    super(403, "forbidden", message);
  }
}

/** Also used for "exists but you're not a member" so we don't leak which workspaces exist. */
export class NotFound extends AppError {
  constructor(message = "Not found") {
    super(404, "not_found", message);
  }
}

/** Optimistic-concurrency failure. `details.current` carries the server's current state. */
export class Conflict extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "conflict", message, details);
  }
}

export class BadRequest extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "bad_request", message, details);
  }
}
