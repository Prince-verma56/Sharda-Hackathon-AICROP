import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/providers.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/widgets/brand.dart';
import '../../../shared/widgets/language_toggle.dart';
import '../../../shared/widgets/links.dart';
import '../application/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l = AppLocalizations.of(context);
    final e164 = PhoneInput.normalise(_phone.text);
    if (e164 == null) {
      setState(() => _error = l.phoneInvalid);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final challenge = await ref.read(authControllerProvider.notifier).requestOtp(e164);
      if (!mounted) return;
      await context.push(Routes.verifyOtp, extra: challenge);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e, l));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final config = ref.watch(mobileConfigProvider).value;
    final signedOutReason = switch (ref.watch(authControllerProvider)) { AuthSignedOut(:final reason) => reason, _ => null };

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          children: [
            Row(children: [
              Flexible(child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: BrandLockup(name: ref.watch(appConfigProvider).appName))),
              const SizedBox(width: 12),
              // Not signed in yet: the choice is saved on the device and sent with the OTP.
              const LanguageToggleButton(syncToServer: false),
            ]),
            const SizedBox(height: 28),
            FadeSlideIn(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(CropRadii.card),
                child: Stack(children: [
                  Image.asset('assets/images/leaf.jpg', height: 190, width: double.infinity, fit: BoxFit.cover),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [CropColors.green950.withValues(alpha: 0.85), Colors.transparent], begin: Alignment.bottomLeft, end: Alignment.topRight),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 20,
                    bottom: 18,
                    right: 20,
                    child: Text(l.splashTagline, style: theme.textTheme.titleLarge?.copyWith(color: Colors.white)),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: 28),
            Text(l.loginTitle, style: theme.textTheme.headlineSmall),
            const SizedBox(height: 6),
            Text(l.loginSubtitle, style: theme.textTheme.bodyMedium?.copyWith(color: CropColors.muted)),
            if (signedOutReason != null && signedOutReason != 'SESSION_ENDED') ...[
              const SizedBox(height: 14),
              Text(l.errSessionEnded, style: const TextStyle(color: CropColors.amber900, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 22),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')), LengthLimitingTextInputFormatter(16)],
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: 1.2),
              decoration: InputDecoration(
                labelText: l.phoneLabel,
                hintText: l.phoneHint,
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(left: 16, right: 8),
                  child: Text('+91', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                ),
                prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
                errorText: _error,
                errorMaxLines: 4,
              ),
              onSubmitted: (_) => _send(),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _busy ? null : _send,
              child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text(l.sendOtp),
            ),
            if (config?.otpMode == 'development') ...[
              const SizedBox(height: 14),
              Text(l.devOtpNote, style: theme.textTheme.bodySmall?.copyWith(color: CropColors.amber900)),
            ],
            const SizedBox(height: 26),
            Text(l.legalNote, style: theme.textTheme.bodySmall?.copyWith(color: CropColors.muted)),
            Wrap(spacing: 4, children: [
              WebLinkButton(label: l.terms, path: config?.links['terms'] ?? '/terms-and-conditions'),
              WebLinkButton(label: l.privacyPolicy, path: config?.links['privacyPolicy'] ?? '/privacy-policy'),
            ]),
          ],
        ),
      ),
    );
  }
}
