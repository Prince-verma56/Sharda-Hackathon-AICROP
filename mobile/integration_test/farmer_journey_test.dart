/// On-device journey (emulator or phone) against the REAL backend and model.
///
///   npm run mobile:test-session      # in the repo root; copy refreshToken
///   cd mobile
///   flutter test integration_test --flavor dev \
///     --dart-define=E2E_API_BASE_URL=http://10.0.2.2:3000 \
///     --dart-define=E2E_REFRESH_TOKEN=$REFRESH_TOKEN
///
/// OTP itself needs a real SMS, so the session is seeded with a refresh token minted by the
/// development-only script; everything after sign-in is the real app UI.
library;

import 'package:cropai_mobile/app.dart';
import 'package:cropai_mobile/core/config/app_config.dart';
import 'package:cropai_mobile/core/providers.dart';
import 'package:cropai_mobile/core/storage/token_store.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/date_symbol_data_local.dart';

const _baseUrl = String.fromEnvironment('E2E_API_BASE_URL');
const _refresh = String.fromEnvironment('E2E_REFRESH_TOKEN');

Future<void> pumpUntil(WidgetTester tester, Finder finder, {Duration timeout = const Duration(seconds: 90)}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 400));
    if (finder.evaluate().isNotEmpty) return;
  }
  throw TestFailure('Timed out waiting for $finder');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('farmer journey: home -> crop -> sample photo -> real report -> Hindi -> Mitra -> logout', (tester) async {
    await initializeDateFormatting();
    final config = (AppConfig.parse(rawBaseUrl: _baseUrl, rawEnvironment: 'development', allowLoopback: true) as AppConfigOk).config;
    final tokens = TokenStore(PlatformSecureStore());
    await tokens.clear();
    await tokens.save(AuthTokens(accessToken: 'expired'.padRight(43, 'x'), accessExpiresAt: DateTime(2000), refreshToken: _refresh, refreshExpiresAt: DateTime.now().add(const Duration(days: 1))));

    await tester.pumpWidget(ProviderScope(
      overrides: [appConfigProvider.overrideWithValue(config), tokenStoreProvider.overrideWithValue(tokens)],
      retry: (_, _) => null,
      child: const CropAiApp(),
    ));

    // Home (signed in through a REAL token refresh)
    await pumpUntil(tester, find.text('Check my crop'));
    await tester.tap(find.text('Check my crop'));
    await pumpUntil(tester, find.text("I don't know the crop"));

    // Crop: the first crop of the model's real list
    await tester.tap(find.text('Tomato').first);
    await pumpUntil(tester, find.text('Try a sample photo'));

    // Licensed sample photo -> review -> REAL upload + inference
    final sample = find.descendant(of: find.byType(ListView).last, matching: find.byType(GestureDetector)).first;
    await tester.tap(sample);
    await pumpUntil(tester, find.text('Check my crop'));
    await tester.tap(find.text('Check my crop'));
    await pumpUntil(tester, find.text('Model score'), timeout: const Duration(minutes: 2));
    expect(find.text('Not rated'), findsOneWidget);

    // Hindi: switch language from the profile tab and check the home screen
    await tester.pageBack();
    await pumpUntil(tester, find.text('Profile'));
    await tester.tap(find.text('Profile'));
    await pumpUntil(tester, find.text('हिंदी'));
    await tester.tap(find.text('हिंदी'));
    await pumpUntil(tester, find.text('प्रोफ़ाइल'));
    await tester.tap(find.text('होम'));
    await pumpUntil(tester, find.text('अपनी फसल जांचें'));

    // Mitra text (same backend workflow as the web)
    await tester.tap(find.text('मित्र'));
    await pumpUntil(tester, find.byType(TextField));
    await tester.enterText(find.byType(TextField).last, 'मेरी पिछली रिपोर्ट का क्या मतलब है?');
    await tester.tap(find.byIcon(Icons.send_rounded));
    await pumpUntil(tester, find.byIcon(Icons.refresh_rounded).hitTestable().evaluate().isNotEmpty ? find.byIcon(Icons.refresh_rounded) : find.byType(SelectableText).at(1), timeout: const Duration(minutes: 2));

    // Logout (server revocation is verified by the acceptance test)
    await tester.tap(find.text('प्रोफ़ाइल'));
    await pumpUntil(tester, find.text('लॉग आउट'));
    await tester.scrollUntilVisible(find.text('लॉग आउट'), 300, scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('लॉग आउट'));
    await pumpUntil(tester, find.byType(AlertDialog));
    await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('लॉग आउट')));
    await pumpUntil(tester, find.text('अपने मोबाइल नंबर से साइन इन करें'));
  }, skip: _baseUrl.isEmpty || _refresh.isEmpty);
}
