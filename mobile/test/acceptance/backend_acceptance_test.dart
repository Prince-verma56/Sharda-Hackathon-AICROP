/// END-TO-END ACCEPTANCE against the REAL local backend and the REAL AgriSmart model.
/// No mocks: the app's own ApiClient, token handling and repositories talk to Next.js, which
/// calls FastAPI/AgriSmart, PostgreSQL and the Mitra workflow.
///
///   # 1. backend running (npm run dev, inference container up)
///   # 2. mint a session for the automated test farmer (dev database only):
///   npm run mobile:test-session            # copy "refreshToken"
///   # 3. run (from mobile/):
///   flutter test test/acceptance --dart-define=E2E_API_BASE_URL=http://localhost:3000 \
///     --dart-define=E2E_REFRESH_TOKEN=$REFRESH_TOKEN
///
/// Skipped automatically when the defines are missing (e.g. in CI without a backend).
library;

import 'package:cropai_mobile/core/config/app_config.dart';
import 'package:cropai_mobile/core/errors/api_exception.dart';
import 'package:cropai_mobile/core/network/api_client.dart';
import 'package:cropai_mobile/core/storage/prefs_store.dart';
import 'package:cropai_mobile/core/storage/token_store.dart';
import 'package:cropai_mobile/core/utilities/json.dart';
import 'package:cropai_mobile/features/assistant/data/assistant_repository.dart';
import 'package:cropai_mobile/features/authentication/data/auth_repository.dart';
import 'package:cropai_mobile/features/camera/data/photo_service.dart';
import 'package:cropai_mobile/features/diagnosis/data/diagnosis_repository.dart';
import 'package:cropai_mobile/shared/services/farmer_repository.dart';
import 'package:flutter_test/flutter_test.dart';

const _baseUrl = String.fromEnvironment('E2E_API_BASE_URL');
const _refresh = String.fromEnvironment('E2E_REFRESH_TOKEN');
/// Optional: the access token printed with the refresh token (valid 15 min).
const _access = String.fromEnvironment('E2E_ACCESS_TOKEN');

void main() {
  final skip = _baseUrl.isEmpty || _refresh.isEmpty ? 'set E2E_API_BASE_URL and E2E_REFRESH_TOKEN to run against the real backend' : null;
  late ApiClient api;
  late TokenStore tokens;
  late PrefsStore prefs;
  late String diagnosisId;
  late String sampleCrop;

  setUpAll(() async {
    if (skip != null) return;
    final config = (AppConfig.parse(rawBaseUrl: _baseUrl, rawEnvironment: 'development', allowLoopback: true) as AppConfigOk).config;
    tokens = TokenStore(MemorySecureStore());
    // With only a refresh token, the expired access token forces a real refresh on the first call.
    await tokens.save(AuthTokens(
      accessToken: _access.isEmpty ? 'expired'.padRight(43, 'x') : _access,
      accessExpiresAt: _access.isEmpty ? DateTime(2000) : DateTime.now().add(const Duration(minutes: 13)),
      refreshToken: _refresh,
      refreshExpiresAt: DateTime.now().add(const Duration(days: 1)),
    ));
    prefs = PrefsStore(MemoryPrefsStore());
    api = ApiClient(config: config, tokens: tokens, logRequests: true, userAgent: 'CropAI-Mobile/acceptance', deviceName: 'acceptance test');
  });

  test('1a. /auth/me resolves the farmer from the shared PostgreSQL identity', () async {
    final me = await AuthRepository(api, tokens, prefs).me();
    expect(me.isFarmer, isTrue);
    expect(me.phoneMasked, contains('•'));
  }, skip: skip);

  test('1b. refresh rotates both tokens and the spent refresh token is refused', () async {
    final before = tokens.current!.refreshToken;
    final next = await api.refreshTokens();
    expect(next, isNotNull);
    expect(next!.refreshToken, isNot(before), reason: 'refresh token must rotate');
    expect(next.accessExpiresAt.difference(DateTime.now()).inMinutes, inInclusiveRange(13, 15));
    final bare = ApiClient(config: api.config, tokens: TokenStore(MemorySecureStore()), logRequests: false);
    await expectLater(
      bare.post('/api/v1/auth/token/refresh', auth: false, body: {'refreshToken': before}, parse: (d) => d),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', anyOf('REFRESH_IN_PROGRESS', 'REFRESH_REUSED'))),
    );
  }, skip: skip);

  test('2. crop catalogue comes from the loaded AgriSmart checkpoint', () async {
    final cached = await FarmerRepository(api, prefs).crops();
    final c = cached.value;
    expect(c.modelVersion, isNotEmpty);
    expect(c.crops.length, greaterThan(10));
    expect(c.samples, isNotEmpty, reason: 'licensed sample photos are needed for the real upload test');
    expect(c.questions.map((q) => q.key), containsAll(['cropStage', 'parts']));
    sampleCrop = c.samples.first.crop;
    // ignore: avoid_print
    print('[acceptance] model ${c.modelVersion}: ${c.crops.length} crops; sample ${c.samples.first.file} (${c.samples.first.crop})');
  }, skip: skip);

  test('3. REAL inference: upload a real leaf photo -> AgriSmart -> stored report', () async {
    final catalogue = (await FarmerRepository(api, prefs).crops()).value;
    final sample = catalogue.samples.first;
    final bytes = await api.getBytes(sample.url);
    final type = PhotoService.sniffImageType(bytes);
    expect(type, isNotNull);
    final started = DateTime.now();
    var lastProgress = 0.0;
    diagnosisId = await DiagnosisRepository(api, prefs).upload(
      DiagnosisUpload(
        cropId: sample.crop,
        bytes: bytes,
        filename: sample.file,
        mimeType: type!,
        consent: true,
        fieldContext: {'capturedAt': '2026-11-14T10:00:00+05:30', 'cropStage': 'flowering', 'parts': ['leaves'], 'note': 'acceptance test'},
      ),
      onProgress: (sent, total) => lastProgress = total > 0 ? sent / total : 0,
    );
    expect(diagnosisId, isNotEmpty);
    expect(lastProgress, 1.0);
    // ignore: avoid_print
    print('[acceptance] diagnosis $diagnosisId in ${DateTime.now().difference(started).inMilliseconds} ms');
  }, skip: skip, timeout: const Timeout(Duration(minutes: 3)));

  test('4. the report holds the real model output, in English and Hindi', () async {
    final repo = DiagnosisRepository(api, prefs);
    final en = (await repo.report(diagnosisId, 'en')).report;
    expect(en.model.version, isNotEmpty);
    expect(en.predictions, isNotEmpty);
    expect(en.predictions.first.rank, 1);
    expect(en.result.score, inInclusiveRange(0.0, 1.0));
    expect(en.predictions.fold<double>(0, (a, p) => a + p.score), lessThanOrEqualTo(1.0001));
    expect(en.result.severity, isNull);
    expect(en.heatmapAvailable, isFalse);
    expect(en.crop.id, sampleCrop);
    expect(en.fieldNotes?.items.map((i) => i.key), contains('cropStage'));
    final photo = await api.getBytes(en.imageUrl);
    expect(PhotoService.sniffImageType(photo), isNotNull, reason: 'stored photo is served back to its owner');
    final hi = (await repo.report(diagnosisId, 'hi')).report;
    expect(hi.language, 'hi');
    expect(hi.disclaimer, contains('AI'));
    // ignore: avoid_print
    print('[acceptance] ${en.crop.name}: ${en.result.condition} ${(en.result.score * 100).round()}% (${en.model.name} ${en.model.version}); explanation: ${en.explanation?.source}');
  }, skip: skip);

  test('5. history (PostgreSQL) lists the new report first, with cursor pagination', () async {
    final repo = FarmerRepository(api, prefs);
    final page = await repo.history(limit: 1);
    expect(page.items.first.id, diagnosisId);
    expect(page.total, greaterThanOrEqualTo(1));
    if (page.total > 1) expect(page.nextCursor, isNotNull);
  }, skip: skip);

  test('6. "I don\'t know the crop": the model predicts the crop too', () async {
    final catalogue = (await FarmerRepository(api, prefs).crops()).value;
    final sample = catalogue.samples.last;
    final bytes = await api.getBytes(sample.url);
    final repo = DiagnosisRepository(api, prefs);
    final id = await repo.upload(DiagnosisUpload(cropId: 'auto', bytes: bytes, filename: sample.file, mimeType: PhotoService.sniffImageType(bytes)!, consent: true));
    final report = (await repo.report(id, 'en')).report;
    expect(report.crop.source, 'model');
    // ignore: avoid_print
    print('[acceptance] auto-crop: predicted ${report.crop.id} / ${report.result.condition} (sample labelled ${sample.crop} / ${sample.condition})');
  }, skip: skip, timeout: const Timeout(Duration(minutes: 3)));

  test('7. Mitra text uses the shared backend workflow and keeps report context', () async {
    final repo = AssistantRepository(api);
    final thread = await repo.thread(diagnosisId: diagnosisId, fresh: true);
    expect(thread.report?.id, diagnosisId);
    try {
      final answer = await repo.ask(message: 'What does this result mean?', diagnosisId: diagnosisId, turnId: 'acc-${DateTime.now().millisecondsSinceEpoch}');
      expect(answer.answer.trim(), isNotEmpty);
      expect(answer.conversationId, isNotEmpty);
      final followUp = await repo.ask(message: 'What should I do first?', conversationId: answer.conversationId, turnId: 'acc2-${DateTime.now().millisecondsSinceEpoch}');
      expect(followUp.conversationId, answer.conversationId, reason: 'follow-up continues the same conversation');
      // ignore: avoid_print
      print('[acceptance] Mitra (${answer.mode}): ${answer.answer.substring(0, answer.answer.length.clamp(0, 160))}');
    } on ApiException catch (e) {
      // A server without an LLM configured answers with a clear code — reported, not hidden.
      // ignore: avoid_print
      print('[acceptance] Mitra unavailable on this server: ${e.code}');
      expect(e.code, anyOf('GENAI_NOT_CONFIGURED', 'GENAI_UNAVAILABLE'));
    }
  }, skip: skip, timeout: const Timeout(Duration(minutes: 2)));

  test('8. voice session: server-built Vapi config with a PUBLIC key only', () async {
    final repo = AssistantRepository(api);
    try {
      final session = await repo.startVoice(diagnosisId: diagnosisId);
      expect(session.publicKey, isNotEmpty);
      expect(session.assistant['model'], isA<Map<String, dynamic>>());
      expect(session.assistant['artifactPlan'], containsPair('recordingEnabled', false));
      final serialized = session.assistant.toString();
      expect(serialized.contains('VAPI_API_KEY'), isFalse);
      await repo.endVoice(session.voiceSessionId, 0);
      // ignore: avoid_print
      print('[acceptance] voice session ${session.voiceSessionId} ok (conversation ${session.conversationId})');
    } on ApiException catch (e) {
      expect(e.code, 'VOICE_NOT_CONFIGURED');
    }
  }, skip: skip);

  test('9. feedback and expert review request are stored', () async {
    final repo = DiagnosisRepository(api, prefs);
    await repo.feedback(diagnosisId, helpful: true, comment: 'acceptance test');
    expect(await repo.requestExpert(diagnosisId), anyOf('PENDING', 'CONFIRMED', 'CHALLENGED'));
    final report = (await repo.report(diagnosisId, 'en')).report;
    expect(report.feedbackHelpful, isTrue);
  }, skip: skip);

  test('10. logout revokes the session on the server', () async {
    final spent = tokens.current!.refreshToken;
    await AuthRepository(api, tokens, prefs).logout();
    expect(tokens.current, isNull);
    final bare = ApiClient(config: api.config, tokens: TokenStore(MemorySecureStore()), logRequests: false);
    await expectLater(
      bare.post('/api/v1/auth/token/refresh', auth: false, body: {'refreshToken': spent}, parse: (d) => asJson(d)),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', 'SESSION_REVOKED')),
    );
  }, skip: skip);
}
