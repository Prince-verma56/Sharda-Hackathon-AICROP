/// One error type for every backend call. Screens switch on [kind]; [code] is the backend's
/// machine-readable code (e.g. OTP_INVALID, INFERENCE_OFFLINE) and [message] its text.
enum ApiErrorKind {
  offline,
  timeout,
  cancelled,
  unauthorized,
  forbidden,
  notFound,
  validation,
  conflict,
  rateLimited,
  unavailable,
  server,
  badResponse,
  unknown,
}

class ApiException implements Exception {
  const ApiException({
    required this.kind,
    this.code,
    this.message,
    this.statusCode,
    this.requestId,
    this.details = const {},
  });

  final ApiErrorKind kind;
  final String? code;
  final String? message;
  final int? statusCode;
  final String? requestId;
  final Map<String, Object?> details;

  /// Network-level problems where retrying the same safe request can help.
  bool get isTransient => kind == ApiErrorKind.offline || kind == ApiErrorKind.timeout || kind == ApiErrorKind.unavailable;

  /// The session is gone (expired, revoked, replayed refresh token): the user must sign in again.
  bool get isSessionEnded =>
      kind == ApiErrorKind.unauthorized &&
      const {'UNAUTHORIZED', 'REFRESH_INVALID', 'REFRESH_EXPIRED', 'SESSION_REVOKED', 'REFRESH_REUSED', 'SESSION_ENDED'}.contains(code);

  static ApiErrorKind kindForStatus(int status) => switch (status) {
        400 || 415 || 422 || 428 => ApiErrorKind.validation,
        401 => ApiErrorKind.unauthorized,
        403 => ApiErrorKind.forbidden,
        404 || 410 => ApiErrorKind.notFound,
        409 => ApiErrorKind.conflict,
        413 => ApiErrorKind.validation,
        429 => ApiErrorKind.rateLimited,
        502 || 503 || 504 => ApiErrorKind.unavailable,
        >= 500 => ApiErrorKind.server,
        _ => ApiErrorKind.unknown,
      };

  @override
  String toString() => 'ApiException(${kind.name}, code: $code, status: $statusCode, requestId: $requestId)';
}
