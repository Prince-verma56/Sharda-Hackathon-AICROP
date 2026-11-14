import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/app_config.dart';
import 'network/api_client.dart';
import 'storage/prefs_store.dart';
import 'storage/token_store.dart';

/// App-wide singletons. main.dart overrides [appConfigProvider] (and tests override any of them).
final appConfigProvider = Provider<AppConfig>((ref) => throw UnimplementedError('appConfigProvider must be overridden in main()'));

final appVersionProvider = Provider<String>((ref) => '1.0.0');

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore(PlatformSecureStore()));

final prefsStoreProvider = Provider<PrefsStore>((ref) => PrefsStore(PlatformPrefsStore()));

final apiClientProvider = Provider<ApiClient>((ref) {
  final config = ref.watch(appConfigProvider);
  final version = ref.watch(appVersionProvider);
  final os = Platform.isAndroid ? 'Android' : Platform.operatingSystem;
  final client = ApiClient(
    config: config,
    tokens: ref.watch(tokenStoreProvider),
    userAgent: 'CropAI-Mobile/$version ($os; ${config.environment.name})',
    deviceName: '$os · CropAI $version',
  );
  return client;
});
