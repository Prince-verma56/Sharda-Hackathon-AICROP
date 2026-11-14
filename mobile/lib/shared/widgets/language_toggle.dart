import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/generated/app_localizations.dart';
import '../../core/localization/locale_controller.dart';
import '../../core/theme/app_theme.dart';

/// Compact switch that shows the OTHER language's name ("हिंदी" while in English, "English"
/// while in Hindi) — one tap, recognisable even to someone who cannot read the current language.
class LanguageToggleButton extends ConsumerWidget {
  const LanguageToggleButton({super.key, this.syncToServer = true});
  final bool syncToServer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final current = ref.watch(localeProvider).languageCode;
    final next = current == 'hi' ? 'en' : 'hi';
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44), padding: const EdgeInsets.symmetric(horizontal: 14), foregroundColor: CropColors.green900),
      onPressed: () => ref.read(localeProvider.notifier).setLanguage(next, syncToServer: syncToServer),
      icon: const Icon(Icons.translate_rounded, size: 18),
      label: Text(next == 'hi' ? l.languageHindi : l.languageEnglish),
    );
  }
}
