import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/localization/delegates.dart';
import 'core/localization/generated/app_localizations.dart';
import 'core/localization/locale_controller.dart';
import 'core/providers.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'shared/widgets/brand.dart';

class CropAiApp extends ConsumerWidget {
  const CropAiApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: ref.watch(appConfigProvider).appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      locale: ref.watch(localeProvider),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: appLocalizationsDelegates,
      routerConfig: ref.watch(routerProvider),
    );
  }
}

/// Shown instead of the app when the build has no valid API_BASE_URL / APP_ENV.
class ConfigErrorApp extends StatelessWidget {
  const ConfigErrorApp({super.key, required this.errors});
  final List<String> errors;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: appLocalizationsDelegates,
      home: Builder(builder: (context) {
        final l = AppLocalizations.of(context);
        return Scaffold(
          body: SafeArea(
            child: ListView(padding: const EdgeInsets.all(24), children: [
              const BrandLockup(name: 'CropAI'),
              const SizedBox(height: 32),
              Text(l.configErrorTitle, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(l.configErrorBody),
              const SizedBox(height: 16),
              for (final e in errors)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text('• $e', style: const TextStyle(fontFamily: 'monospace', fontSize: 13)),
                ),
            ]),
          ),
        );
      }),
    );
  }
}
