import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Non-secret preferences and offline caches. Never tokens (see TokenStore).
abstract interface class KeyValueStore {
  Future<String?> getString(String key);
  Future<void> setString(String key, String value);
  Future<void> remove(String key);
  Future<Set<String>> keys();
}

class PlatformPrefsStore implements KeyValueStore {
  PlatformPrefsStore([SharedPreferencesAsync? prefs]) : _prefs = prefs ?? SharedPreferencesAsync();
  final SharedPreferencesAsync _prefs;

  @override
  Future<String?> getString(String key) => _prefs.getString(key);
  @override
  Future<void> setString(String key, String value) => _prefs.setString(key, value);
  @override
  Future<void> remove(String key) => _prefs.remove(key);
  @override
  Future<Set<String>> keys() => _prefs.getKeys();
}

class MemoryPrefsStore implements KeyValueStore {
  final Map<String, String> values = {};
  @override
  Future<String?> getString(String key) async => values[key];
  @override
  Future<void> setString(String key, String value) async => values[key] = value;
  @override
  Future<void> remove(String key) async => values.remove(key);
  @override
  Future<Set<String>> keys() async => values.keys.toSet();
}

/// Typed access to what the app keeps on the device.
class PrefsStore {
  PrefsStore(this._kv);
  final KeyValueStore _kv;

  static const _kLanguage = 'pref.language';
  static const _kOnboardingSkipped = 'pref.onboarding_skipped.';
  static const _kCachePrefix = 'cache.';

  Future<String?> language() => _kv.getString(_kLanguage);
  Future<void> setLanguage(String code) => _kv.setString(_kLanguage, code);

  Future<bool> onboardingSkipped(String userId) async => (await _kv.getString('$_kOnboardingSkipped$userId')) == '1';
  Future<void> setOnboardingSkipped(String userId) => _kv.setString('$_kOnboardingSkipped$userId', '1');

  /// Offline copies (resources, last home screen, recently opened reports) with the time saved.
  Future<void> writeCache(String key, Object? json) =>
      _kv.setString('$_kCachePrefix$key', jsonEncode({'savedAt': DateTime.now().toUtc().toIso8601String(), 'data': json}));

  Future<CachedJson?> readCache(String key) async {
    final raw = await _kv.getString('$_kCachePrefix$key');
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, Object?>;
      return CachedJson(DateTime.parse(decoded['savedAt']! as String), decoded['data']);
    } catch (_) {
      await _kv.remove('$_kCachePrefix$key');
      return null;
    }
  }

  /// Personal caches (reports, home) are removed at logout; public ones (resources) are kept.
  Future<void> clearPersonalCaches() async {
    for (final key in await _kv.keys()) {
      if (key.startsWith(_kCachePrefix) && !key.startsWith('${_kCachePrefix}public.')) await _kv.remove(key);
    }
  }
}

class CachedJson {
  const CachedJson(this.savedAt, this.data);
  final DateTime savedAt;
  final Object? data;
}
