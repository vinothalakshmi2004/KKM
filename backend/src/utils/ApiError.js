export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }

  static badRequest(message, errors) { return new ApiError(400, message, errors); }
  static unauthorized(message = 'Authentication required') { return new ApiError(401, message); }
  static forbidden(message = 'Not allowed') { return new ApiError(403, message); }
  static notFound(message = 'Not found') { return new ApiError(404, message); }
  static conflict(message, errors) { return new ApiError(409, message, errors); }
}
