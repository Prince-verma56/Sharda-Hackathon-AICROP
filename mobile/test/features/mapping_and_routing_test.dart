import 'dart:typed_data';
import 'dart:ui';

import 'package:cropai_mobile/core/errors/api_exception.dart';
import 'package:cropai_mobile/core/errors/error_messages.dart';
import 'package:cropai_mobile/core/localization/generated/app_localizations.dart';
import 'package:cropai_mobile/core/routing/app_router.dart';
import 'package:cropai_mobile/features/authentication/application/auth_controller.dart';
import 'package:cropai_mobile/features/authentication/data/auth_models.dart';
import 'package:cropai_mobile/features/camera/application/scan_controller.dart';
import 'package:cropai_mobile/features/camera/data/photo_service.dart';
import 'package:cropai_mobile/features/diagnosis/data/report_models.dart';
import 'package:cropai_mobile/shared/models/farmer_models.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixtures.dart';

Me me({bool farmer = true, bool onboarded = true, bool volunteer = false}) => Me(
      userId: 'u1',
      phoneMasked: '+91 98•••••210',
      name: null,
      roles: [if (farmer) 'FARMER', if (volunteer) 'VOLUNTEER'],
      workspaces: [if (farmer) 'farmer', if (volunteer) 'volunteer'],
      farmer: farmer ? FarmerSummary(preferredName: 'Asha', language: 'hi', onboarded: onboarded) : null,
      volunteer: volunteer ? const VolunteerSummary(serviceArea: null, verificationStatus: 'VERIFIED', trainingStatus: 'COMPLETED', profileComplete: true) : null,
    );

void main() {
  group('FarmerReport.fromJson (backend report shape)', () {
    final r = FarmerReport.fromJson(sampleReportJson());

    test('keeps the real model output and ranks predictions', () {
      expect(r.result.condition, 'Late blight');
      expect(r.result.scorePercent, 82);
      expect(r.predictions.map((p) => p.rank), [1, 2, 3]);
      expect(r.predictions.first.score, closeTo(0.82, 1e-9));
      expect(r.model.version, 'india-model-v1');
    });

    test('values the backend does not have stay unavailable (never invented)', () {
      expect(r.result.severity, isNull);
      expect(r.heatmapAvailable, isFalse);
      expect(r.references.last.imageUrl, isNull);
    });

    test('maps recommendations, advisories, weather, field notes and history', () {
      expect(r.actions.map((a) => a.kind), [ActionKind.inspect, ActionKind.prevent, ActionKind.expert]);
      expect(r.result.advisories.single.code, 'WEAK_CLASS_UPSTREAM');
      expect(r.result.uncertain, isTrue);
      expect(r.weather!.forecast, hasLength(2));
      expect(r.weather!.providerLabel, 'Open-Meteo');
      expect(r.fieldNotes!.items.single.value, 'Flowering');
      expect(r.history.where((h) => h.current), hasLength(1));
      expect(r.crop.detectedByModel, isFalse);
      expect(r.lookFor.approved, isTrue);
    });

    test('tolerates missing optional sections', () {
      final minimal = FarmerReport.fromJson({'id': 'd1', 'createdAt': '2026-11-14T00:00:00Z'});
      expect(minimal.weather, isNull);
      expect(minimal.predictions, isEmpty);
      expect(minimal.imageUrl, '/api/v1/images/diagnoses/d1');
    });
  });

  group('CropCatalogue.fromJson', () {
    test('reads crops, popular ids and the field-detail questions', () {
      final c = CropCatalogue.fromJson(sampleCatalogueJson());
      expect(c.crops.map((x) => x.id), ['potato', 'tomato']);
      expect(c.byId('tomato')!.name('hi'), 'टमाटर');
      expect(c.questions.firstWhere((q) => q.key == 'parts').multiple, isTrue);
      expect(c.questions.firstWhere((q) => q.key == 'cropStage').options.first.label('hi'), 'पौध');
      expect(c.byId('tomato')!.matches('टम'), isTrue);
    });
  });

  group('router redirects (server roles decide)', () {
    test('unknown -> splash; signed out -> login (auth screens allowed)', () {
      expect(redirectFor(const AuthUnknown(), Routes.home), Routes.splash);
      expect(redirectFor(const AuthSignedOut(), Routes.home), Routes.login);
      expect(redirectFor(const AuthSignedOut(), Routes.verifyOtp), isNull);
    });
    test('signed-in farmer leaves auth screens; onboarding first unless skipped', () {
      expect(redirectFor(AuthSignedIn(me()), Routes.login), Routes.home);
      expect(redirectFor(AuthSignedIn(me(onboarded: false)), Routes.home), Routes.onboarding);
      expect(redirectFor(AuthSignedIn(me(onboarded: false), onboardingSkipped: true), Routes.home), isNull);
    });
    test('volunteer-only accounts go to the volunteer workspace; others are blocked', () {
      expect(redirectFor(AuthSignedIn(me(farmer: false, volunteer: true)), Routes.home), Routes.volunteer);
      expect(redirectFor(AuthSignedIn(me(farmer: false)), Routes.home), Routes.noWorkspace);
      expect(redirectFor(AuthSignedIn(me()), Routes.volunteer), Routes.home, reason: 'no volunteer role, no volunteer screen');
    });
    test('deep links keep their parameters', () {
      expect(Routes.assistantWith(diagnosisId: 'd1', question: 'What now?', voice: true), '/farmer/assistant?diagnosisId=d1&q=What+now%3F&voice=1');
    });
  });

  group('scan request', () {
    test('device timestamp keeps the local UTC offset', () {
      final ts = ScanController.deviceTimestamp(DateTime(2026, 11, 14, 6, 48, 10));
      expect(ts, matches(RegExp(r'^2026-11-14T06:48:10[+-]\d{2}:\d{2}$')));
    });

    test('photo validation sniffs real image bytes, not names', () async {
      expect(PhotoService.sniffImageType(Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0])), 'image/jpeg');
      expect(PhotoService.sniffImageType(Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0])), 'image/png');
      expect(PhotoService.sniffImageType(Uint8List.fromList('GIF89a'.codeUnits)), isNull);
      await expectLater(PhotoService.validate(Uint8List(0), filename: 'x.jpg', source: 'gallery'), throwsA(isA<PhotoException>()));
      await expectLater(
        PhotoService.validate(Uint8List(9 * 1024 * 1024), filename: 'big.jpg', source: 'gallery'),
        throwsA(isA<PhotoException>().having((e) => e.problem, 'problem', PhotoProblem.tooLarge)),
      );
    });
  });

  group('localised errors', () {
    final en = lookupAppLocalizations(const Locale('en'));
    final hi = lookupAppLocalizations(const Locale('hi'));
    test('backend codes map to translated messages', () {
      const e = ApiException(kind: ApiErrorKind.validation, code: 'OTP_INVALID', message: 'The OTP is not correct.');
      expect(errorMessage(e, en), 'The code is not correct.');
      expect(errorMessage(e, hi), 'कोड सही नहीं है।');
      expect(errorMessage(const ApiException(kind: ApiErrorKind.unavailable, code: 'INFERENCE_OFFLINE'), hi), hi.errInferenceOffline);
    });
    test('network kinds map without a backend code; unknown text never leaks in Hindi', () {
      expect(errorMessage(const ApiException(kind: ApiErrorKind.offline), en), en.errOffline);
      expect(errorMessage(const ApiException(kind: ApiErrorKind.server, message: 'Internal detail'), hi), hi.errGeneric);
      expect(errorMessage(StateError('x'), en), en.errGeneric);
    });
    test('every English string has a Hindi translation', () {
      expect(hi.localeName, 'hi');
      expect(hi.actionCheckCrop, isNot(en.actionCheckCrop));
      expect(hi.checksCount(3), '3 जांच');
      expect(en.checksCount(1), '1 check');
    });
  });
}
