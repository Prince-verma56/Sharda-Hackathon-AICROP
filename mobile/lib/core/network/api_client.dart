import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../errors/api_exception.dart';
import '../storage/token_store.dart';

/// The single HTTP client of the app. Every feature goes through it; no screen builds URLs.
///
///  - base URL from [AppConfig] (the Next.js API gateway only)
///  - `Authorization: Bearer <access token>` from secure storage
///  - proactive refresh shortly before the 15-minute access token expires, and one retry after
///    a 401; concurrent refreshes are collapsed into one (single flight) because the server
///    treats a replayed refresh token as theft and revokes the session
///  - safe (GET) requests retry twice on network errors / 502-504; uploads, OTP and other
///    non-idempotent requests never retry automatically
///  - `X-Request-Id` on every request; debug logs never contain tokens, codes or phone numbers
class ApiClient {
  ApiClient({
    required this.config,
    required this.tokens,
    this.userAgent = 'CropAI-Mobile',
    this.deviceName,
    HttpClientAdapter? adapter,
    bool? logRequests,
  })  : _logRequests = logRequests ?? kDebugMode,
        dio = Dio(_options(config, userAgent)),
        _bare = Dio(_options(config, userAgent)) {
    if (adapter != null) {
      dio.httpClientAdapter = adapter;
      _bare.httpClientAdapter = adapter;
    }
    dio.interceptors.addAll([
      _RequestIdInterceptor(),
      _AuthInterceptor(this),
      _RetryInterceptor(dio),
      if (_logRequests) _RedactingLogInterceptor(),
    ]);
    _bare.interceptors.addAll([_RequestIdInterceptor(), if (_logRequests) _RedactingLogInterceptor()]);
  }

  final AppConfig config;
  final TokenStore tokens;
  final String userAgent;
  String? deviceName;
  final bool _logRequests;

  /// Main client (auth + retry interceptors).
  final Dio dio;

  /// Bare client for the refresh call itself (no auth interceptor, so no recursion).
  final Dio _bare;

  final StreamController<String> _sessionEnded = StreamController<String>.broadcast();

  /// Emits the backend code (e.g. REFRESH_REUSED) when the session can no longer be refreshed.
  Stream<String> get sessionEnded => _sessionEnded.stream;

  Future<AuthTokens?>? _refreshing;

  static const defaultReceiveTimeout = Duration(seconds: 30);

  static BaseOptions _options(AppConfig config, String userAgent) => BaseOptions(
        baseUrl: config.apiBaseUrl.toString(),
        connectTimeout: const Duration(seconds: 10),
        sendTimeout: const Duration(seconds: 30),
        receiveTimeout: defaultReceiveTimeout,
        headers: {HttpHeaders.acceptHeader: 'application/json', HttpHeaders.userAgentHeader: userAgent},
        // The backend answers JSON envelopes for errors too; Dio raises for non-2xx.
        responseType: ResponseType.json,
      );

  /// Absolute URL for a backend path ("/api/v1/images/..." or "/images/crops/x.jpg").
  Uri resolve(String pathOrUrl) {
    final parsed = Uri.parse(pathOrUrl);
    return parsed.hasScheme ? parsed : config.apiBaseUrl.replace(path: parsed.path, query: parsed.hasQuery ? parsed.query : null);
  }

  // ---- JSON envelope calls ---------------------------------------------------------------

  Future<T> get<T>(
    String path, {
    Map<String, Object?>? query,
    required T Function(Object? data) parse,
    bool auth = true,
    CancelToken? cancelToken,
    Duration? timeout,
  }) =>
      _send(() => dio.get<Object?>(path, queryParameters: _clean(query), cancelToken: cancelToken, options: _opts(auth, timeout)), parse);

  Future<T> post<T>(
    String path, {
    Object? body,
    required T Function(Object? data) parse,
    bool auth = true,
    CancelToken? cancelToken,
    Duration? timeout,
  }) =>
      _send(() => dio.post<Object?>(path, data: body ?? const <String, Object?>{}, cancelToken: cancelToken, options: _opts(auth, timeout, json: true)), parse);

  Future<T> put<T>(String path, {Object? body, required T Function(Object? data) parse, Duration? timeout}) =>
      _send(() => dio.put<Object?>(path, data: body ?? const <String, Object?>{}, options: _opts(true, timeout, json: true)), parse);

  Future<T> patch<T>(String path, {Object? body, required T Function(Object? data) parse, Duration? timeout}) =>
      _send(() => dio.patch<Object?>(path, data: body ?? const <String, Object?>{}, options: _opts(true, timeout, json: true)), parse);

  Future<T> delete<T>(String path, {required T Function(Object? data) parse}) =>
      _send(() => dio.delete<Object?>(path, options: _opts(true, null)), parse);

  /// Multipart upload with progress. Never retried automatically (a retry could create a
  /// second report); the screen offers a manual retry instead.
  Future<T> upload<T>(
    String path, {
    required FormData Function() form,
    required T Function(Object? data) parse,
    void Function(int sent, int total)? onSendProgress,
    CancelToken? cancelToken,
    Duration sendTimeout = const Duration(seconds: 90),
    Duration receiveTimeout = const Duration(seconds: 100),
  }) =>
      _send(
        () => dio.post<Object?>(
          path,
          data: form(),
          cancelToken: cancelToken,
          onSendProgress: onSendProgress,
          options: Options(
            sendTimeout: sendTimeout,
            receiveTimeout: receiveTimeout,
            contentType: 'multipart/form-data',
            extra: const {'auth': true, 'idempotent': false, 'formFactory': true},
          ),
        ),
        parse,
      );

  /// Raw bytes (private images: diagnosis photos, reference photos, samples).
  Future<Uint8List> getBytes(String path, {CancelToken? cancelToken}) async {
    try {
      final response = await dio.get<List<int>>(
        path,
        cancelToken: cancelToken,
        options: Options(responseType: ResponseType.bytes, extra: const {'auth': true, 'idempotent': true}),
      );
      final data = response.data;
      if (data == null) throw const ApiException(kind: ApiErrorKind.badResponse, code: 'EMPTY_BODY');
      return data is Uint8List ? data : Uint8List.fromList(data);
    } on DioException catch (e) {
      throw toApiException(e);
    }
  }

  // ---- tokens -----------------------------------------------------------------------------

  /// Exchanges the refresh token for a new pair. Concurrent callers share one network call.
  /// Returns null when the session ended (tokens cleared, [sessionEnded] emitted); throws an
  /// [ApiException] for network problems (tokens kept — the user stays signed in offline).
  Future<AuthTokens?> refreshTokens() {
    final pending = _refreshing;
    if (pending != null) return pending;
    final future = _doRefresh();
    _refreshing = future;
    return future.whenComplete(() => _refreshing = null);
  }

  Future<AuthTokens?> _doRefresh() async {
    final current = await tokens.load();
    if (current == null) return null;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final response = await _bare.post<Object?>(
          '/api/v1/auth/token/refresh',
          data: {'refreshToken': current.refreshToken, 'deviceName': ?deviceName},
          options: Options(contentType: Headers.jsonContentType),
        );
        final next = AuthTokens.fromJson(_unwrap(response.data) as Map<String, Object?>);
        await tokens.save(next);
        return next;
      } on DioException catch (e) {
        final status = e.response?.statusCode;
        final code = _errorCode(e.response?.data);
        if (status == 409 && code == 'REFRESH_IN_PROGRESS') {
          // Another refresh just rotated this token; if it was ours, the newer pair is stored.
          await Future<void>.delayed(Duration(milliseconds: 300 * (attempt + 1)));
          final stored = tokens.current;
          if (stored != null && stored.refreshToken != current.refreshToken) return stored;
          continue;
        }
        if (status == 401 || status == 403) {
          await tokens.clear();
          _sessionEnded.add(code ?? 'SESSION_ENDED');
          return null;
        }
        throw toApiException(e);
      } on FormatException {
        throw const ApiException(kind: ApiErrorKind.badResponse, code: 'BAD_TOKEN_RESPONSE');
      }
    }
    throw const ApiException(kind: ApiErrorKind.conflict, code: 'REFRESH_IN_PROGRESS');
  }

  /// Called by the auth layer after logout / when the server says the session is gone.
  void notifySessionEnded(String code) => _sessionEnded.add(code);

  // ---- internals ----------------------------------------------------------------------------

  Options _opts(bool auth, Duration? timeout, {bool json = false}) => Options(
        receiveTimeout: timeout,
        contentType: json ? Headers.jsonContentType : null,
        extra: {'auth': auth},
      );

  Future<T> _send<T>(Future<Response<Object?>> Function() call, T Function(Object? data) parse) async {
    try {
      final response = await call();
      return parse(_unwrap(response.data));
    } on DioException catch (e) {
      throw toApiException(e);
    }
  }

  static Map<String, Object?>? _clean(Map<String, Object?>? query) =>
      query == null ? null : {for (final e in query.entries) if (e.value != null) e.key: e.value};

  /// `{ success: true, data }` -> data. A 2xx with `success: false` is still an error.
  static Object? _unwrap(Object? body) {
    if (body is Map<String, Object?>) {
      if (body['success'] == true) return body['data'];
      if (body['success'] == false) {
        final error = body['error'];
        throw ApiException(
          kind: ApiErrorKind.badResponse,
          code: error is Map ? error['code'] as String? : null,
          message: error is Map ? error['message'] as String? : null,
        );
      }
    }
    throw const ApiException(kind: ApiErrorKind.badResponse, code: 'NOT_AN_ENVELOPE');
  }

  static String? _errorCode(Object? body) {
    if (body is Map && body['error'] is Map) return (body['error'] as Map)['code'] as String?;
    return null;
  }

  /// DioException -> ApiException (the only error type screens see).
  static ApiException toApiException(DioException e) {
    if (e.error is ApiException) return e.error! as ApiException;
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiException(kind: ApiErrorKind.timeout, code: 'TIMEOUT');
      case DioExceptionType.cancel:
        return const ApiException(kind: ApiErrorKind.cancelled, code: 'CANCELLED');
      case DioExceptionType.connectionError:
        return const ApiException(kind: ApiErrorKind.offline, code: 'NETWORK_UNREACHABLE');
      case DioExceptionType.badCertificate:
        return const ApiException(kind: ApiErrorKind.unknown, code: 'BAD_CERTIFICATE');
      case DioExceptionType.badResponse:
        final status = e.response?.statusCode ?? 0;
        final body = e.response?.data;
        String? code;
        String? message;
        String? requestId;
        Map<String, Object?> details = const {};
        if (body is Map) {
          final error = body['error'];
          if (error is Map) {
            code = error['code'] as String?;
            message = error['message'] as String?;
            if (error['details'] is Map) details = Map<String, Object?>.from(error['details'] as Map);
          }
          final meta = body['meta'];
          if (meta is Map) requestId = meta['requestId'] as String?;
        }
        return ApiException(kind: ApiException.kindForStatus(status), code: code, message: message, statusCode: status, requestId: requestId, details: details);
      case DioExceptionType.unknown:
        if (e.error is SocketException || e.error is HttpException) return const ApiException(kind: ApiErrorKind.offline, code: 'NETWORK_UNREACHABLE');
        return ApiException(kind: ApiErrorKind.unknown, code: 'UNKNOWN', message: e.message);
    }
  }
}

class _RequestIdInterceptor extends Interceptor {
  final _random = Random();
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers['X-Request-Id'] = 'm-${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${_random.nextInt(1 << 32).toRadixString(36)}';
    options.extra['startedAt'] = DateTime.now().millisecondsSinceEpoch;
    handler.next(options);
  }
}

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this.client);
  final ApiClient client;

  bool _wantsAuth(RequestOptions o) => o.extra['auth'] != false;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (!_wantsAuth(options)) return handler.next(options);
    try {
      var tokens = await client.tokens.load();
      if (tokens != null && tokens.accessExpiresWithin(const Duration(seconds: 60))) {
        tokens = await client.refreshTokens();
      }
      if (tokens != null) options.headers[HttpHeaders.authorizationHeader] = 'Bearer ${tokens.accessToken}';
      handler.next(options);
    } on ApiException catch (error) {
      handler.reject(DioException(requestOptions: options, error: error, type: DioExceptionType.unknown));
    }
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    if (err.response?.statusCode != 401 || !_wantsAuth(options) || options.extra['authRetried'] == true) {
      return handler.next(err);
    }
    try {
      final tokens = await client.refreshTokens();
      if (tokens == null) return handler.next(err);
      options.extra['authRetried'] = true;
      options.headers[HttpHeaders.authorizationHeader] = 'Bearer ${tokens.accessToken}';
      // A multipart body is a one-shot stream: clone it for the retry.
      if (options.data is FormData) options.data = (options.data as FormData).clone();
      final response = await client.dio.fetch<Object?>(options);
      handler.resolve(response);
    } on DioException catch (e) {
      handler.next(e);
    } on ApiException catch (error) {
      handler.next(DioException(requestOptions: options, error: error, type: DioExceptionType.unknown));
    }
  }
}

class _RetryInterceptor extends Interceptor {
  _RetryInterceptor(this.dio);
  final Dio dio;
  static const _delays = [Duration(milliseconds: 600), Duration(milliseconds: 1800)];

  bool _retryable(DioException e) {
    final o = e.requestOptions;
    final safe = o.method == 'GET' || o.method == 'HEAD' || o.extra['idempotent'] == true;
    if (!safe || o.extra['idempotent'] == false) return false;
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) return true;
    final status = e.response?.statusCode;
    return status == 502 || status == 503 || status == 504;
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    final attempt = (options.extra['retryAttempt'] as int?) ?? 0;
    if (!_retryable(err) || attempt >= _delays.length) return handler.next(err);
    await Future<void>.delayed(_delays[attempt]);
    options.extra['retryAttempt'] = attempt + 1;
    try {
      handler.resolve(await dio.fetch<Object?>(options));
    } on DioException catch (e) {
      handler.next(e);
    }
  }
}

/// Debug-only request log: method, path, status, duration and request id. Never headers,
/// bodies, tokens, OTP codes or phone numbers.
class _RedactingLogInterceptor extends Interceptor {
  static final _digits = RegExp(r'\d{6,}');
  String _path(RequestOptions o) => o.path.replaceAll(_digits, '•••');
  int _ms(RequestOptions o) => DateTime.now().millisecondsSinceEpoch - ((o.extra['startedAt'] as int?) ?? 0);

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    final o = response.requestOptions;
    debugPrint('[api] ${o.method} ${_path(o)} -> ${response.statusCode} ${_ms(o)}ms ${o.headers['X-Request-Id']}');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final o = err.requestOptions;
    final body = err.response?.data;
    final code = body is Map && body['error'] is Map ? (body['error'] as Map)['code'] : err.type.name;
    debugPrint('[api] ${o.method} ${_path(o)} -> ${err.response?.statusCode ?? '-'} $code ${_ms(o)}ms ${o.headers['X-Request-Id']}');
    handler.next(err);
  }
}
