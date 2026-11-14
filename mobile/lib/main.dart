import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting();
  final version = (await PackageInfo.fromPlatform()).version;

  switch (AppConfig.fromEnvironment()) {
    case AppConfigError(:final errors):
      runApp(ConfigErrorApp(errors: errors));
    case AppConfigOk(:final config):
      runApp(ProviderScope(
        overrides: [
          appConfigProvider.overrideWithValue(config),
          appVersionProvider.overrideWithValue(version),
        ],
        // Errors are shown to the farmer with a retry button instead of silent automatic retries.
        retry: (_, _) => null,
        child: const CropAiApp(),
      ));
  }
}
