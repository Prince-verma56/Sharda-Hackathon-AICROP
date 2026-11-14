import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/providers.dart';
import '../data/auth_models.dart';
import '../data/auth_repository.dart';

sealed class AuthState {
  const AuthState();
}

/// Still restoring the session (splash). [error] is set when it could not be checked.
class AuthUnknown extends AuthState {
  const AuthUnknown([this.error]);
  final Object? error;
}

class AuthSignedOut extends AuthState {
  const AuthSignedOut([this.reason]);
  /// backend code when the server ended the session (e.g. REFRESH_REUSED)
  final String? reason;
}

class AuthSignedIn extends AuthState {
  const AuthSignedIn(this.me, {this.offline = false, this.onboardingSkipped = false});
  final Me me;
  /// opened from the cached identity because the server could not be reached
  final bool offline;
  final bool onboardingSkipped;

  bool get needsOnboarding => me.isFarmer && !(me.farmer?.onboarded ?? true) && !onboardingSkipped;
}

class AuthController extends Notifier<AuthState> {
  StreamSubscription<String>? _sessionSub;

  @override
  AuthState build() {
    _sessionSub = ref.read(apiClientProvider).sessionEnded.listen((code) {
      if (state is AuthSignedIn) state = AuthSignedOut(code);
    });
    ref.onDispose(() => _sessionSub?.cancel());
    unawaited(Future<void>.microtask(restore));
    return const AuthUnknown();
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  /// Splash: resume a stored session (refreshing tokens as needed).
  Future<void> restore() async {
    state = const AuthUnknown();
    if (!await _repo.hasStoredSession()) {
      state = const AuthSignedOut();
      return;
    }
    try {
      await _signedIn(await _repo.me());
    } on ApiException catch (e) {
      if (e.isSessionEnded || e.kind == ApiErrorKind.forbidden) {
        await _repo.logout();
        state = AuthSignedOut(e.code);
        return;
      }
      final cached = await _repo.cachedMe();
      state = cached != null && e.isTransient ? AuthSignedIn(cached, offline: true, onboardingSkipped: await _skipped(cached)) : AuthUnknown(e);
    } catch (e) {
      state = AuthUnknown(e);
    }
  }

  Future<OtpChallenge> requestOtp(String phoneE164) =>
      _repo.startOtp(phoneE164: phoneE164, language: ref.read(localeProvider).languageCode);

  Future<void> verifyOtp(String phoneE164, String code) async {
    final me = await _repo.verifyOtp(phoneE164: phoneE164, code: code, language: ref.read(localeProvider).languageCode);
    await _signedIn(me);
  }

  /// Re-reads identity (after onboarding, profile or language changes).
  Future<void> refreshMe() async {
    try {
      await _signedIn(await _repo.me(), adoptLanguage: false);
    } on ApiException catch (e) {
      if (e.isSessionEnded) state = AuthSignedOut(e.code);
    }
  }

  Future<void> skipOnboarding() async {
    final current = state;
    if (current is! AuthSignedIn) return;
    await ref.read(prefsStoreProvider).setOnboardingSkipped(current.me.userId);
    state = AuthSignedIn(current.me, offline: current.offline, onboardingSkipped: true);
  }

  Future<void> logout({bool everywhere = false}) async {
    await _repo.logout(everywhere: everywhere);
    state = const AuthSignedOut();
  }

  Future<bool> _skipped(Me me) => ref.read(prefsStoreProvider).onboardingSkipped(me.userId);

  Future<void> _signedIn(Me me, {bool adoptLanguage = true}) async {
    if (adoptLanguage) await ref.read(localeProvider.notifier).adoptServerLanguage(me.farmer?.language);
    state = AuthSignedIn(me, onboardingSkipped: await _skipped(me));
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Public server facts (brand, assistant name, OTP mode, voice availability). Falls back to
/// defaults offline so the login screen always renders.
final mobileConfigProvider = FutureProvider<MobileConfig>((ref) async {
  try {
    return await ref.read(authRepositoryProvider).mobileConfig();
  } catch (_) {
    return MobileConfig.fallback;
  }
});

final assistantNameProvider = Provider<String>((ref) => ref.watch(mobileConfigProvider).value?.assistantName ?? 'Mitra');
