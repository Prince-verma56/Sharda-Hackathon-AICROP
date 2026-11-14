import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../application/auth_controller.dart';
import '../data/auth_models.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.challenge});
  final OtpChallenge challenge;
  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  final _focus = FocusNode();
  Timer? _timer;
  late int _wait = widget.challenge.resendAfterSeconds;
  late OtpChallenge _challenge = widget.challenge;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _startTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_wait <= 0) return t.cancel();
      setState(() => _wait--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final l = AppLocalizations.of(context);
    final code = _code.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code) || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // On success the router leaves this screen (auth state -> signed in).
      await ref.read(authControllerProvider.notifier).verifyOtp(_challenge.phoneE164, code);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = errorMessage(e, l));
      _code.clear();
      _focus.requestFocus();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    final l = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      _challenge = await ref.read(authControllerProvider.notifier).requestOtp(_challenge.phoneE164);
      _wait = _challenge.resendAfterSeconds;
      _startTimer();
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
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: () => context.pop())),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(24, 8, 24, 24), children: [
          Text(l.otpTitle, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(l.otpSentTo(Fmt.maskPhone(_challenge.phoneE164)), style: theme.textTheme.bodyLarge?.copyWith(color: CropColors.muted)),
          if (_challenge.development) ...[
            const SizedBox(height: 10),
            Text(l.devOtpNote, style: theme.textTheme.bodySmall?.copyWith(color: CropColors.amber900)),
          ],
          const SizedBox(height: 28),
          TextField(
            controller: _code,
            focusNode: _focus,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.oneTimeCode],
            textAlign: TextAlign.center,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: 14),
            decoration: InputDecoration(counterText: '', hintText: '••••••', errorText: _error, errorMaxLines: 4),
            onChanged: (v) {
              if (v.length == 6) unawaited(_verify());
            },
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _busy ? null : _verify,
            child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text(l.otpVerify),
          ),
          const SizedBox(height: 10),
          // Wrap, not Row: Hindi labels are long and budget phones are ~360 dp wide.
          Wrap(alignment: WrapAlignment.spaceBetween, spacing: 8, children: [
            TextButton(onPressed: () => context.pop(), child: Text(l.changeNumber)),
            TextButton(onPressed: _wait > 0 || _busy ? null : _resend, child: Text(_wait > 0 ? l.otpResendIn(_wait) : l.otpResend)),
          ]),
        ]),
      ),
    );
  }
}
