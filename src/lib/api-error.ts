export type ApiError = {
  error: {
    code: string       // e.g. 'PRIVATE_IP', 'UPSTREAM_ERROR', 'NOT_FOUND', 'INVALID_INPUT'
    message: string    // Human-readable message for card display
    upstreamStatus?: number  // HTTP status from upstream API (when proxying a failure)
  }
}
