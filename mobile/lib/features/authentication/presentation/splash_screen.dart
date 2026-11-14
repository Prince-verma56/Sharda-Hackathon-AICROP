import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/widgets/brand.dart';
import '../../../shared/widgets/common.dart';
import '../application/auth_controller.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final l = AppLocalizations.of(context);
    final name = ref.watch(appConfigProvider).appName;
    final error = auth is AuthUnknown ? auth.error : null;
    return Scaffold(
      backgroundColor: CropColors.green950,
      body: SafeArea(
        child: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            FadeSlideIn(
              child: PulseRing(
                color: CropColors.green500,
                active: error == null,
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: const BoxDecoration(color: CropColors.green900, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: const LeafMark(size: 52, color: CropColors.green200),
                ),
              ),
            ),
            const SizedBox(height: 28),
            FadeSlideIn(delay: const Duration(milliseconds: 120), child: BrandLockup(name: name, dark: true, size: 34)),
            const SizedBox(height: 10),
            FadeSlideIn(
              delay: const Duration(milliseconds: 220),
              child: Text(l.splashTagline, style: const TextStyle(color: CropColors.green200, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 36),
            if (error == null)
              const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2.5, color: CropColors.green200))
            else
              Theme(
                data: Theme.of(context).copyWith(textTheme: Theme.of(context).textTheme.apply(bodyColor: Colors.white)),
                child: ErrorView(error: error, compact: true, onRetry: () => ref.read(authControllerProvider.notifier).restore()),
              ),
          ]),
        ),
      ),
    );
  }
}

/// Signed in, but the server granted neither a farmer nor a volunteer workspace (e.g. admin-only
/// accounts: administration stays on the web).
class NoWorkspaceScreen extends ConsumerWidget {
  const NoWorkspaceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      body: EmptyState(
        icon: Icons.admin_panel_settings_outlined,
        title: l.errForbidden,
        hint: l.volunteerWebNote,
        action: FilledButton(onPressed: () => ref.read(authControllerProvider.notifier).logout(), child: Text(l.logout)),
      ),
    );
  }
}
