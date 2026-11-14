import 'package:cropai_mobile/core/config/app_config.dart';
import 'package:cropai_mobile/core/storage/token_store.dart';
import 'package:cropai_mobile/core/utilities/formatters.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppConfig.parse', () {
    test('accepts a LAN development URL and strips a trailing slash', () {
      final r = AppConfig.parse(rawBaseUrl: 'http://192.168.1.10:3000/', rawEnvironment: 'development');
      expect(r, isA<AppConfigOk>());
      final c = (r as AppConfigOk).config;
      expect(c.apiBaseUrl.toString(), 'http://192.168.1.10:3000');
      expect(c.environment, AppEnvironment.development);
    });

    test('accepts the emulator host alias', () {
      expect(AppConfig.parse(rawBaseUrl: 'http://10.0.2.2:3000', rawEnvironment: 'dev'), isA<AppConfigOk>());
    });

    test('rejects a missing URL with a helpful message', () {
      final r = AppConfig.parse(rawBaseUrl: '', rawEnvironment: 'development') as AppConfigError;
      expect(r.errors.single, contains('API_BASE_URL is missing'));
    });

    test('rejects localhost on a phone unless loopback (adb reverse) is explicitly allowed', () {
      expect(AppConfig.parse(rawBaseUrl: 'http://localhost:3000', rawEnvironment: 'development'), isA<AppConfigError>());
      expect(AppConfig.parse(rawBaseUrl: 'http://127.0.0.1:3000', rawEnvironment: 'development'), isA<AppConfigError>());
      expect(AppConfig.parse(rawBaseUrl: 'http://localhost:3000', rawEnvironment: 'development', allowLoopback: true), isA<AppConfigOk>());
      // never in staging/production, even with the flag
      expect(AppConfig.parse(rawBaseUrl: 'https://localhost', rawEnvironment: 'production', allowLoopback: true), isA<AppConfigError>());
    });

    test('staging and production require https', () {
      expect(AppConfig.parse(rawBaseUrl: 'http://cropai.example.in', rawEnvironment: 'staging'), isA<AppConfigError>());
      expect(AppConfig.parse(rawBaseUrl: 'http://cropai.example.in', rawEnvironment: 'production'), isA<AppConfigError>());
      expect(AppConfig.parse(rawBaseUrl: 'https://cropai.example.in', rawEnvironment: 'production'), isA<AppConfigOk>());
    });

    test('rejects paths, queries, unknown schemes and unknown environments', () {
      expect(AppConfig.parse(rawBaseUrl: 'http://192.168.1.10:3000/api', rawEnvironment: 'development'), isA<AppConfigError>());
      expect(AppConfig.parse(rawBaseUrl: 'http://192.168.1.10:3000?x=1', rawEnvironment: 'development'), isA<AppConfigError>());
      expect(AppConfig.parse(rawBaseUrl: 'ftp://192.168.1.10', rawEnvironment: 'development'), isA<AppConfigError>());
      expect(AppConfig.parse(rawBaseUrl: 'http://192.168.1.10:3000', rawEnvironment: 'qa'), isA<AppConfigError>());
    });
  });

  group('PhoneInput.normalise (Indian mobile numbers)', () {
    test('10-digit numbers get +91', () {
      expect(PhoneInput.normalise('98765 43210'), '+919876543210');
      expect(PhoneInput.normalise('9123456789'), '+919123456789'); // starts with 91 — not a prefix
    });
    test('accepts +91, 91 and 0 prefixes', () {
      expect(PhoneInput.normalise('+91 98765-43210'), '+919876543210');
      expect(PhoneInput.normalise('919876543210'), '+919876543210');
      expect(PhoneInput.normalise('09876543210'), '+919876543210');
    });
    test('rejects invalid numbers', () {
      expect(PhoneInput.normalise('12345'), isNull);
      expect(PhoneInput.normalise('5876543210'), isNull); // Indian mobiles start with 6-9
      expect(PhoneInput.normalise('+91 12345 67890'), isNull);
    });
    test('masks numbers for display', () {
      expect(Fmt.maskPhone('+919876543210'), '+91 98•••••210');
    });
  });

  group('TokenStore', () {
    test('saves, reloads and clears tokens; keeps a stable install id', () async {
      final mem = MemorySecureStore();
      final store = TokenStore(mem);
      expect(await store.load(), isNull);
      final tokens = AuthTokens(
        accessToken: 'a' * 43,
        accessExpiresAt: DateTime.utc(2030, 1, 1, 0, 15),
        refreshToken: 'r' * 43,
        refreshExpiresAt: DateTime.utc(2030, 1, 31),
      );
      await store.save(tokens);
      final reloaded = await TokenStore(mem).load();
      expect(reloaded?.accessToken, tokens.accessToken);
      expect(reloaded?.refreshExpiresAt, tokens.refreshExpiresAt);
      final id = await store.deviceId();
      expect(id, matches(RegExp(r'^and_[a-z0-9]{24}$')));
      expect(await store.deviceId(), id);
      await store.clear();
      expect(await TokenStore(mem).load(), isNull);
      expect(await store.deviceId(), id, reason: 'logout keeps the install id');
    });

    test('parses the verify/refresh response and detects near expiry', () {
      final t = AuthTokens.fromJson({
        'accessToken': 'a' * 43,
        'accessTokenExpiresAt': '2030-01-01T00:15:00.000Z',
        'refreshToken': 'r' * 43,
        'refreshTokenExpiresAt': '2030-01-31T00:00:00.000Z',
      });
      expect(t.accessExpiresWithin(const Duration(seconds: 60), now: DateTime.utc(2030, 1, 1, 0, 14, 30)), isTrue);
      expect(t.accessExpiresWithin(const Duration(seconds: 60), now: DateTime.utc(2030, 1, 1, 0, 10)), isFalse);
      expect(() => AuthTokens.fromJson({'accessToken': 'x'}), throwsFormatException);
    });
  });
}
