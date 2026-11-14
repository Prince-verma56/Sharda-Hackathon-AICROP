import 'dart:convert';
import 'dart:typed_data';

import 'package:cropai_mobile/core/config/app_config.dart';
import 'package:cropai_mobile/core/localization/delegates.dart';
import 'package:cropai_mobile/core/localization/locale_controller.dart';
import 'package:cropai_mobile/core/network/api_client.dart';
import 'package:cropai_mobile/core/providers.dart';
import 'package:cropai_mobile/core/storage/prefs_store.dart';
import 'package:cropai_mobile/core/storage/token_store.dart';
import 'package:cropai_mobile/core/theme/app_theme.dart';
import 'package:cropai_mobile/features/assistant/application/assistant_controller.dart';
import 'package:cropai_mobile/features/assistant/data/assistant_repository.dart';
import 'package:cropai_mobile/features/assistant/presentation/assistant_screen.dart';
import 'package:cropai_mobile/features/authentication/application/auth_controller.dart';
import 'package:cropai_mobile/features/authentication/data/auth_models.dart';
import 'package:cropai_mobile/features/authentication/presentation/login_screen.dart';
import 'package:cropai_mobile/features/authentication/presentation/otp_screen.dart';
import 'package:cropai_mobile/features/camera/application/scan_controller.dart';
import 'package:cropai_mobile/features/camera/data/photo_service.dart';
import 'package:cropai_mobile/features/camera/presentation/review_screen.dart';
import 'package:cropai_mobile/features/crops/presentation/crop_picker_screen.dart';
import 'package:cropai_mobile/features/diagnosis/data/diagnosis_repository.dart';
import 'package:cropai_mobile/features/diagnosis/data/report_models.dart';
import 'package:cropai_mobile/features/diagnosis/presentation/report_screen.dart';
import 'package:cropai_mobile/features/home/presentation/home_screen.dart';
import 'package:cropai_mobile/shared/models/farmer_models.dart';
import 'package:cropai_mobile/shared/services/farmer_repository.dart';
import 'package:cropai_mobile/shared/widgets/common.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../fixtures.dart';

final _config = (AppConfig.parse(rawBaseUrl: 'http://192.168.1.10:3000', rawEnvironment: 'development') as AppConfigOk).config;

/// 1×1 transparent PNG — stands in for photos in widget tests.
final _png = Uint8List.fromList(base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='));

class _SignedOutAuth extends AuthController {
  @override
  AuthState build() => const AuthSignedOut();
  @override
  Future<OtpChallenge> requestOtp(String phoneE164) async =>
      OtpChallenge(phoneE164: phoneE164, expiresInSeconds: 600, resendAfterSeconds: 30, development: false);
}

class _SignedInAuth extends AuthController {
  @override
  AuthState build() => const AuthSignedIn(Me(
        userId: 'u1',
        phoneMasked: '+91 98•••••210',
        name: 'Asha',
        roles: ['FARMER'],
        workspaces: ['farmer'],
        farmer: FarmerSummary(preferredName: 'Asha', language: 'en', onboarded: true),
        volunteer: null,
      ));
}

class _FakeDiagnosisRepo extends DiagnosisRepository {
  _FakeDiagnosisRepo() : super(ApiClient(config: _config, tokens: TokenStore(MemorySecureStore()), logRequests: false), PrefsStore(MemoryPrefsStore()));
  @override
  Future<LoadedReport> report(String id, String lang) async => LoadedReport(FarmerReport.fromJson(sampleReportJson(id: id)));
}

class _FakeAssistantRepo extends AssistantRepository {
  _FakeAssistantRepo() : super(ApiClient(config: _config, tokens: TokenStore(MemorySecureStore()), logRequests: false));
  final asked = <String>[];
  @override
  Future<MitraThread> thread({String? conversationId, String? diagnosisId, bool fresh = false}) async => MitraThread.fromJson({
        'assistantName': 'Mitra',
        'conversationId': 'conv1',
        'persisted': false,
        'messages': [
          {'id': 'm1', 'role': 'farmer', 'text': 'Hello', 'channel': 'text'},
          {'id': 'm2', 'role': 'mitra', 'text': 'Namaste! How can I help?', 'channel': 'voice'},
        ],
        'report': {'id': 'cmtestreport0001', 'focused': false, 'crop': 'Tomato', 'condition': 'Late blight', 'createdAt': '2026-11-14T00:00:00Z', 'isHealthy': false},
        'consent': {'chatHistory': false, 'voiceTranscripts': false},
        'savedConversations': <Object?>[],
        'voiceAvailable': true,
      });
  @override
  Future<ChatAnswer> ask({required String message, String? conversationId, String? diagnosisId, required String turnId}) async {
    asked.add(message);
    return const ChatAnswer(answer: 'Remove the affected leaves first.', conversationId: 'conv1', persisted: false, mode: 'ai', sources: []);
  }
}

/// Renders at 360 × 780 dp — the typical budget Android phone — so overflows show up in tests.
Future<ProviderContainer> pump(WidgetTester tester, Widget child, {List<Override> overrides = const []}) async {
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(overrides: [
    appConfigProvider.overrideWithValue(_config),
    tokenStoreProvider.overrideWithValue(TokenStore(MemorySecureStore())),
    prefsStoreProvider.overrideWithValue(PrefsStore(MemoryPrefsStore())),
    mobileConfigProvider.overrideWith((ref) async => MobileConfig.fallback),
    privateImageProvider.overrideWith((ref, path) async => _png),
    ...overrides,
  ]);
  addTearDown(container.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    // Like the real app: the locale follows LocaleController (the language toggle).
    child: Consumer(
      builder: (context, ref, _) => MaterialApp(
        theme: AppTheme.light(),
        locale: ref.watch(localeProvider),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: appLocalizationsDelegates,
        home: child,
      ),
    ),
  ));
  await tester.pump(const Duration(milliseconds: 600));
  return container;
}

void main() {
  testWidgets('login validates the phone number and switches to Hindi', (tester) async {
    await pump(tester, const LoginScreen(), overrides: [authControllerProvider.overrideWith(_SignedOutAuth.new)]);
    expect(find.text('Sign in with your mobile number'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '12345');
    await tester.tap(find.text('Send OTP'));
    await tester.pump();
    expect(find.text('Enter a valid 10-digit mobile number.'), findsOneWidget);

    await tester.tap(find.text('हिंदी'));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.text('अपने मोबाइल नंबर से साइन इन करें'), findsOneWidget);
  });

  testWidgets('OTP screen shows the masked number and the resend countdown', (tester) async {
    await pump(
      tester,
      const OtpScreen(challenge: OtpChallenge(phoneE164: '+919876543210', expiresInSeconds: 600, resendAfterSeconds: 30, development: false)),
      overrides: [authControllerProvider.overrideWith(_SignedOutAuth.new)],
    );
    expect(find.text('We sent a code to +91 98•••••210'), findsOneWidget);
    expect(find.textContaining('Resend in'), findsOneWidget);
    expect(find.text('Verify and continue'), findsOneWidget);
  });

  testWidgets('farmer home shows the greeting, the four big actions and the latest check', (tester) async {
    await pump(tester, const HomeScreen(), overrides: [
      authControllerProvider.overrideWith(_SignedInAuth.new),
      homeProvider.overrideWith((ref) async => Cached(HomeData.fromJson(sampleHomeJson()))),
    ]);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Namaste, Asha'), findsOneWidget);
    expect(find.text('Check my crop'), findsOneWidget);
    expect(find.text('Talk to Mitra'), findsOneWidget);
    expect(find.text('My reports'), findsOneWidget);
    expect(find.text('Learn & government support'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Late blight'), 200);
    expect(find.text('Late blight'), findsOneWidget);
  });

  testWidgets('crop picker lists the model crops, "I don\'t know" and filters by search', (tester) async {
    await pump(tester, const CropPickerScreen(), overrides: [
      cropCatalogueProvider.overrideWith((ref) async => Cached(CropCatalogue.fromJson(sampleCatalogueJson()))),
    ]);
    expect(find.text("I don't know the crop"), findsOneWidget);
    expect(find.text('Tomato'), findsWidgets);
    await tester.enterText(find.byType(TextField), 'pot');
    await tester.pump();
    expect(find.text('Potato'), findsOneWidget);
    expect(find.text('Tomato'), findsNothing);
  });

  testWidgets('review shows the photo preview, retake/replace and the check button', (tester) async {
    final container = await pump(tester, const ReviewScreen(), overrides: [
      cropCatalogueProvider.overrideWith((ref) async => Cached(CropCatalogue.fromJson(sampleCatalogueJson()))),
      profileProvider.overrideWith((ref) async => throw StateError('offline')),
    ]);
    container.read(scanControllerProvider.notifier)
      ..start('tomato')
      ..setPhoto(PickedPhoto(bytes: _png, filename: 'leaf.png', mimeType: 'image/png', width: 1600, height: 1200, source: 'gallery'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Retake'), findsOneWidget);
    expect(find.text('Choose another'), findsOneWidget);
    expect(find.text('Field details (optional)'), findsOneWidget);
    expect(find.text('Check my crop'), findsOneWidget);
    expect(find.textContaining('1600 × 1200 px'), findsOneWidget);
  });

  testWidgets('report shows the real result, top predictions and marks unavailable values', (tester) async {
    await pump(tester, const ReportScreen(id: 'cmtestreport0001'), overrides: [
      authControllerProvider.overrideWith(_SignedInAuth.new),
      diagnosisRepositoryProvider.overrideWithValue(_FakeDiagnosisRepo()),
    ]);
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Late blight'), findsWidgets);
    expect(find.text('Needs attention'), findsOneWidget);
    expect(find.text('Not rated'), findsOneWidget, reason: 'no severity is invented');
    expect(find.text('Model is less reliable for this condition'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Top predictions'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('Early blight'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('validated explanation map'), 400, scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('validated explanation map'), findsOneWidget);
  });

  testWidgets('Mitra chat: history, report context, sending a question, voice controls', (tester) async {
    final repo = _FakeAssistantRepo();
    final container = await pump(tester, const AssistantScreen(), overrides: [
      assistantRepositoryProvider.overrideWithValue(repo),
      authControllerProvider.overrideWith(_SignedInAuth.new),
    ]);
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Namaste! How can I help?'), findsOneWidget);
    expect(find.text('About your report: Tomato · Late blight'), findsOneWidget);
    expect(find.byTooltip('Start voice call'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'What should I do?');
    await tester.tap(find.byTooltip('Send'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(repo.asked, ['What should I do?']);
    expect(find.text('Remove the affected leaves first.'), findsOneWidget);
    expect(find.text('AI answer'), findsOneWidget);

    // Voice controls: a denied microphone shows the reason and a retry button.
    container.read(assistantControllerProvider((diagnosisId: null, conversationId: null, fresh: false)).notifier).micDenied();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Microphone permission is needed for a voice call.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });
}
