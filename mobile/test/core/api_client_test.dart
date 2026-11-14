import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cropai_mobile/core/config/app_config.dart';
import 'package:cropai_mobile/core/errors/api_exception.dart';
import 'package:cropai_mobile/core/network/api_client.dart';
import 'package:cropai_mobile/core/storage/token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Scripted backend: each request is answered by [handler]; every request is recorded.
class FakeBackend implements HttpClientAdapter {
  FakeBackend(this.handler);
  final Future<(int, Object?)> Function(RequestOptions o) handler;
  final List<RequestOptions> requests = [];

  int count(String path) => requests.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    if (requestStream != null) await requestStream.drain<void>();
    final (status, body) = await handler(options);
    return ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

class OfflineBackend implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) =>
      throw DioException(requestOptions: options, type: DioExceptionType.connectionError, error: const SocketException('no route'));
  @override
  void close({bool force = false}) {}
}

Map<String, Object?> ok(Object? data) => {'success': true, 'data': data};
Map<String, Object?> err(String code, [String message = 'm']) => {'success': false, 'error': {'code': code, 'message': message}};

final config = (AppConfig.parse(rawBaseUrl: 'http://192.168.1.10:3000', rawEnvironment: 'development') as AppConfigOk).config;

AuthTokens tokens({String access = 'access-1', String refresh = 'refresh-1', Duration accessLeft = const Duration(minutes: 14)}) => AuthTokens(
      accessToken: access.padRight(43, 'x'),
      accessExpiresAt: DateTime.now().add(accessLeft),
      refreshToken: refresh.padRight(43, 'x'),
      refreshExpiresAt: DateTime.now().add(const Duration(days: 30)),
    );

Map<String, Object?> refreshed(String n) => ok({
      'accessToken': 'access-$n'.padRight(43, 'x'),
      'accessTokenExpiresAt': DateTime.now().add(const Duration(minutes: 15)).toUtc().toIso8601String(),
      'refreshToken': 'refresh-$n'.padRight(43, 'x'),
      'refreshTokenExpiresAt': DateTime.now().add(const Duration(days: 30)).toUtc().toIso8601String(),
    });

Future<(ApiClient, FakeBackend, TokenStore)> build(Future<(int, Object?)> Function(RequestOptions o) handler, {AuthTokens? stored}) async {
  final store = TokenStore(MemorySecureStore());
  if (stored != null) await store.save(stored);
  final backend = FakeBackend(handler);
  return (ApiClient(config: config, tokens: store, adapter: backend, logRequests: false), backend, store);
}

String? bearer(RequestOptions o) => o.headers[HttpHeaders.authorizationHeader] as String?;

void main() {
  test('GET unwraps the envelope and sends Bearer + X-Request-Id; auth:false sends no token', () async {
    final (api, backend, _) = await build((o) async => (200, ok({'value': 42})), stored: tokens());
    final value = await api.get('/api/v1/farmer/home', parse: (d) => (d! as Map)['value']);
    expect(value, 42);
    expect(bearer(backend.requests.single), startsWith('Bearer access-1'));
    expect(backend.requests.single.headers['X-Request-Id'], isNotNull);
    expect(backend.requests.single.uri.toString(), 'http://192.168.1.10:3000/api/v1/farmer/home');

    await api.get('/api/v1/mobile/config', auth: false, parse: (d) => d);
    expect(bearer(backend.requests.last), isNull);
  });

  test('maps error envelopes to typed ApiExceptions', () async {
    final (api, _, _) = await build((o) async => switch (o.path) {
          '/a' => (422, err('IMAGE_SIZE_INVALID')),
          '/b' => (503, err('INFERENCE_OFFLINE')),
          '/c' => (404, err('NOT_FOUND')),
          _ => (429, err('TOO_MANY_REQUESTS')),
        });
    Future<ApiException> fail(String path) async {
      try {
        await api.post(path, parse: (d) => d);
      } on ApiException catch (e) {
        return e;
      }
      throw StateError('expected failure');
    }

    expect((await fail('/a')), isA<ApiException>().having((e) => e.code, 'code', 'IMAGE_SIZE_INVALID').having((e) => e.kind, 'kind', ApiErrorKind.validation));
    expect((await fail('/b')).kind, ApiErrorKind.unavailable);
    expect((await fail('/c')).kind, ApiErrorKind.notFound);
    expect((await fail('/d')).kind, ApiErrorKind.rateLimited);
  });

  test('a 401 refreshes the token once and retries the request with the new access token', () async {
    final (api, backend, store) = await build((o) async {
      if (o.path == '/api/v1/auth/token/refresh') return (200, refreshed('2'));
      return bearer(o)!.startsWith('Bearer access-2') ? (200, ok('fresh')) : (401, err('UNAUTHORIZED'));
    }, stored: tokens());
    expect(await api.get('/api/v1/auth/me', parse: (d) => d), 'fresh');
    expect(backend.count('/api/v1/auth/token/refresh'), 1);
    expect(store.current!.accessToken, startsWith('access-2'));
    final refreshBody = backend.requests.firstWhere((r) => r.path == '/api/v1/auth/token/refresh').data as Map;
    expect(refreshBody['refreshToken'], startsWith('refresh-1'));
  });

  test('concurrent 401s share ONE refresh call (the server would treat a second use as replay)', () async {
    final (api, backend, _) = await build((o) async {
      if (o.path == '/api/v1/auth/token/refresh') {
        await Future<void>.delayed(const Duration(milliseconds: 50));
        return (200, refreshed('2'));
      }
      return bearer(o)!.startsWith('Bearer access-2') ? (200, ok(o.path)) : (401, err('UNAUTHORIZED'));
    }, stored: tokens());
    final results = await Future.wait([for (var i = 0; i < 5; i++) api.get('/r$i', parse: (d) => d)]);
    expect(results, ['/r0', '/r1', '/r2', '/r3', '/r4']);
    expect(backend.count('/api/v1/auth/token/refresh'), 1);
  });

  test('a rejected refresh (replay / revoked) clears tokens and announces the session end', () async {
    final (api, _, store) = await build((o) async {
      if (o.path == '/api/v1/auth/token/refresh') return (401, err('REFRESH_REUSED'));
      return (401, err('UNAUTHORIZED'));
    }, stored: tokens());
    final ended = api.sessionEnded.first;
    await expectLater(api.get('/api/v1/auth/me', parse: (d) => d), throwsA(isA<ApiException>().having((e) => e.isSessionEnded, 'ended', isTrue)));
    expect(await ended, 'REFRESH_REUSED');
    expect(store.current, isNull);
  });

  test('refreshes proactively when the access token is about to expire', () async {
    final (api, backend, _) = await build((o) async {
      if (o.path == '/api/v1/auth/token/refresh') return (200, refreshed('2'));
      return (200, ok(bearer(o)));
    }, stored: tokens(accessLeft: const Duration(seconds: 20)));
    final sent = await api.get('/x', parse: (d) => d);
    expect(sent, startsWith('Bearer access-2'));
    expect(backend.requests.first.path, '/api/v1/auth/token/refresh');
  });

  test('safe GETs retry on 503; POSTs (OTP, uploads, chat) never retry automatically', () async {
    var getCalls = 0;
    final (api, backend, _) = await build((o) async {
      if (o.method == 'GET') return ++getCalls < 3 ? (503, err('INFERENCE_BUSY')) : (200, ok('ok'));
      return (503, err('INFERENCE_BUSY'));
    }, stored: tokens());
    expect(await api.get('/g', parse: (d) => d), 'ok');
    expect(getCalls, 3);
    await expectLater(api.post('/api/v1/auth/otp/start', auth: false, parse: (d) => d), throwsA(isA<ApiException>()));
    expect(backend.count('/api/v1/auth/otp/start'), 1);
  });

  test('network failure is reported as offline and keeps the stored session', () async {
    final store = TokenStore(MemorySecureStore());
    await store.save(tokens(accessLeft: const Duration(seconds: 10))); // forces a refresh attempt
    final api = ApiClient(config: config, tokens: store, adapter: OfflineBackend(), logRequests: false);
    await expectLater(api.get('/x', parse: (d) => d), throwsA(isA<ApiException>().having((e) => e.kind, 'kind', ApiErrorKind.offline)));
    expect(store.current, isNotNull, reason: 'offline must not sign the farmer out');
  });

  test('resolve() builds absolute URLs for backend paths only', () {
    final api = ApiClient(config: config, tokens: TokenStore(MemorySecureStore()), logRequests: false);
    expect(api.resolve('/images/crops/tomato.jpg').toString(), 'http://192.168.1.10:3000/images/crops/tomato.jpg');
    expect(api.resolve('https://pmfby.gov.in/').toString(), 'https://pmfby.gov.in/');
  });
}
