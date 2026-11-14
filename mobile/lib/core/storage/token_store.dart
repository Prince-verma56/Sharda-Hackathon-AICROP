import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Minimal async key-value contract so tests can swap the platform store for memory.
abstract interface class SecureKeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Android Keystore-backed storage (flutter_secure_storage). The ONLY place tokens are kept.
class PlatformSecureStore implements SecureKeyValueStore {
  PlatformSecureStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);
  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);
  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String value) async => values[key] = value;
  @override
  Future<void> delete(String key) async => values.remove(key);
}

class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.accessExpiresAt,
    required this.refreshToken,
    required this.refreshExpiresAt,
  });

  final String accessToken;
  final DateTime accessExpiresAt;
  final String refreshToken;
  final DateTime refreshExpiresAt;

  /// Refresh a little early so a request never leaves with a token that expires in flight.
  bool accessExpiresWithin(Duration margin, {DateTime? now}) => (now ?? DateTime.now()).add(margin).isAfter(accessExpiresAt);
  bool get refreshExpired => DateTime.now().isAfter(refreshExpiresAt);

  /// Parses the verify/refresh response (`accessToken`, `accessTokenExpiresAt`, `refreshToken`, ...).
  static AuthTokens fromJson(Map<String, Object?> json) {
    final access = json['accessToken'] ?? json['token'];
    final accessExp = json['accessTokenExpiresAt'] ?? json['expiresAt'];
    final refresh = json['refreshToken'];
    final refreshExp = json['refreshTokenExpiresAt'];
    if (access is! String || refresh is! String || accessExp is! String || refreshExp is! String) {
      throw const FormatException('Token response is missing fields');
    }
    return AuthTokens(
      accessToken: access,
      accessExpiresAt: DateTime.parse(accessExp),
      refreshToken: refresh,
      refreshExpiresAt: DateTime.parse(refreshExp),
    );
  }
}

/// Session tokens + the random install id. Keeps an in-memory copy so every request does not
/// hit the keystore; the keystore stays the source of truth across restarts.
class TokenStore {
  TokenStore(this._store);
  final SecureKeyValueStore _store;

  static const _kAccess = 'cropai.access_token';
  static const _kAccessExp = 'cropai.access_expires_at';
  static const _kRefresh = 'cropai.refresh_token';
  static const _kRefreshExp = 'cropai.refresh_expires_at';
  static const _kDeviceId = 'cropai.install_id';

  AuthTokens? _cached;
  bool _loaded = false;

  AuthTokens? get current => _cached;

  Future<AuthTokens?> load() async {
    if (_loaded) return _cached;
    final values = await Future.wait([_kAccess, _kAccessExp, _kRefresh, _kRefreshExp].map(_store.read));
    _loaded = true;
    if (values.any((v) => v == null || v.isEmpty)) return _cached = null;
    try {
      _cached = AuthTokens(
        accessToken: values[0]!,
        accessExpiresAt: DateTime.parse(values[1]!),
        refreshToken: values[2]!,
        refreshExpiresAt: DateTime.parse(values[3]!),
      );
    } on FormatException {
      await clear();
    }
    return _cached;
  }

  Future<void> save(AuthTokens tokens) async {
    _cached = tokens;
    _loaded = true;
    await _store.write(_kAccess, tokens.accessToken);
    await _store.write(_kAccessExp, tokens.accessExpiresAt.toUtc().toIso8601String());
    await _store.write(_kRefresh, tokens.refreshToken);
    await _store.write(_kRefreshExp, tokens.refreshExpiresAt.toUtc().toIso8601String());
  }

  Future<void> clear() async {
    _cached = null;
    _loaded = true;
    for (final key in [_kAccess, _kAccessExp, _kRefresh, _kRefreshExp]) {
      await _store.delete(key);
    }
  }

  /// Random per-install id (not a hardware identifier); lets the farmer recognise devices.
  Future<String> deviceId() async {
    final existing = await _store.read(_kDeviceId);
    if (existing != null && RegExp(r'^[A-Za-z0-9_-]{8,64}$').hasMatch(existing)) return existing;
    final random = Random.secure();
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    final id = 'and_${List.generate(24, (_) => alphabet[random.nextInt(alphabet.length)]).join()}';
    await _store.write(_kDeviceId, id);
    return id;
  }
}
