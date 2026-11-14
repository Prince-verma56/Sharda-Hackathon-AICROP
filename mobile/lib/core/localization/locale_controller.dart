import 'dart:async';
import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

/// The app language: English by default, Hindi on request. Saved on the device immediately and,
/// when signed in, on the farmer profile (the backend localises reports and Mitra from it).
class LocaleController extends Notifier<Locale> {
  static const supported = [Locale('en'), Locale('hi')];

  @override
  Locale build() {
    unawaited(_restore());
    return const Locale('en');
  }

  Future<void> _restore() async {
    final saved = await ref.read(prefsStoreProvider).language();
    if (saved == 'hi' || saved == 'en') state = Locale(saved!);
  }

  String get code => state.languageCode;

  /// Changes the UI language; [syncToServer] PATCHes the farmer profile (ignored when offline —
  /// the server value is re-synced at the next sign-in).
  Future<void> setLanguage(String code, {bool syncToServer = true}) async {
    if (code != 'en' && code != 'hi') return;
    state = Locale(code);
    await ref.read(prefsStoreProvider).setLanguage(code);
    if (!syncToServer) return;
    try {
      await ref.read(apiClientProvider).patch<Object?>('/api/v1/farmer/profile', body: {'language': code}, parse: (d) => d);
    } catch (_) {
      // Offline or signed out: the local choice still applies.
    }
  }

  /// Adopt the language stored on the server profile (after sign-in), without echoing it back.
  Future<void> adoptServerLanguage(String? code) async {
    if (code == 'en' || code == 'hi') await setLanguage(code!, syncToServer: false);
  }
}

final localeProvider = NotifierProvider<LocaleController, Locale>(LocaleController.new);
