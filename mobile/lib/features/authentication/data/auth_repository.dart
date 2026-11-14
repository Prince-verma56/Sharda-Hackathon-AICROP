import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs_store.dart';
import '../../../core/storage/token_store.dart';
import 'auth_models.dart';

/// Phone OTP sign-in against the SAME backend identity as the web app. No passwords, no email,
/// no role picker: the server decides roles from PostgreSQL. OTP calls are never retried
/// automatically (each one can send an SMS).
class AuthRepository {
  AuthRepository(this._api, this._tokens, this._prefs);
  final ApiClient _api;
  final TokenStore _tokens;
  final PrefsStore _prefs;

  static const _meCacheKey = 'me';

  Future<MobileConfig> mobileConfig() =>
      _api.get('/api/v1/mobile/config', auth: false, parse: (d) => MobileConfig.fromJson((d! as Map).cast<String, Object?>()));

  Future<OtpChallenge> startOtp({required String phoneE164, required String language}) => _api.post(
        '/api/v1/auth/otp/start',
        auth: false,
        body: {'phoneNumber': phoneE164, 'requestedRole': 'FARMER', 'language': language},
        parse: (d) {
          final j = (d! as Map).cast<String, Object?>();
          return OtpChallenge(
            phoneE164: phoneE164,
            expiresInSeconds: (j['expiresInSeconds'] as num?)?.toInt() ?? 600,
            resendAfterSeconds: (j['resendAfterSeconds'] as num?)?.toInt() ?? 30,
            development: j['delivery'] == 'development',
          );
        },
      );

  /// Verifies the code; on success stores the token pair in secure storage and returns the user.
  Future<Me> verifyOtp({required String phoneE164, required String code, required String language}) async {
    final deviceId = await _tokens.deviceId();
    final tokens = await _api.post(
      '/api/v1/auth/otp/verify',
      auth: false,
      body: {
        'phoneNumber': phoneE164,
        'code': code,
        'requestedRole': 'FARMER',
        'language': language,
        'client': 'mobile',
        'deviceId': deviceId,
        if (_api.deviceName != null) 'deviceName': _api.deviceName,
      },
      parse: (d) => AuthTokens.fromJson((d! as Map).cast<String, Object?>()),
    );
    await _tokens.save(tokens);
    return me();
  }

  Future<Me> me() async {
    final me = await _api.get('/api/v1/auth/me', parse: (d) => Me.fromJson((d! as Map).cast<String, Object?>()));
    await _prefs.writeCache(_meCacheKey, me.toCacheJson());
    return me;
  }

  Future<Me?> cachedMe() async {
    final cached = await _prefs.readCache(_meCacheKey);
    if (cached?.data is! Map) return null;
    try {
      return Me.fromJson((jsonDecode(jsonEncode(cached!.data)) as Map).cast<String, Object?>());
    } catch (_) {
      return null;
    }
  }

  Future<bool> hasStoredSession() async => (await _tokens.load()) != null;

  /// Revokes the session on the server (best effort) and always clears this device.
  Future<void> logout({bool everywhere = false}) async {
    final refresh = _tokens.current?.refreshToken;
    try {
      await _api.post('/api/v1/auth/logout', body: {'everywhere': everywhere, 'refreshToken': ?refresh}, parse: (d) => d);
    } catch (_) {
      // Offline: the device forgets the session anyway; the server session expires on its own.
    }
    await _tokens.clear();
    await _prefs.clearPersonalCaches();
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider), ref.watch(tokenStoreProvider), ref.watch(prefsStoreProvider)),
);
