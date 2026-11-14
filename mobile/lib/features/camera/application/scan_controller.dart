import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/utilities/json.dart';
import '../../diagnosis/data/diagnosis_repository.dart';
import '../data/photo_service.dart';

enum UploadPhase { idle, uploading, analysing, failed, done }

class ScanState {
  const ScanState({
    this.cropId,
    this.photo,
    this.answers = const {},
    this.parts = const [],
    this.note = '',
    this.location,
    this.consent = false,
    this.phase = UploadPhase.idle,
    this.progress = 0,
    this.error,
    this.diagnosisId,
  });

  /// crop id, or "auto" when the farmer does not know the crop
  final String? cropId;
  final PickedPhoto? photo;
  /// single-choice field details: cropStage, firstNoticed, spread, recentWeather, sprayed
  final Map<String, String> answers;
  final List<String> parts;
  final String note;
  final ({double latitude, double longitude, double accuracy})? location;
  final bool consent;
  final UploadPhase phase;
  final double progress;
  final Object? error;
  final String? diagnosisId;

  bool get busy => phase == UploadPhase.uploading || phase == UploadPhase.analysing;

  ScanState copyWith({
    String? cropId,
    PickedPhoto? photo,
    Map<String, String>? answers,
    List<String>? parts,
    String? note,
    ({double latitude, double longitude, double accuracy})? location,
    bool clearLocation = false,
    bool? consent,
    UploadPhase? phase,
    double? progress,
    Object? error,
    bool clearError = false,
    String? diagnosisId,
  }) =>
      ScanState(
        cropId: cropId ?? this.cropId,
        photo: photo ?? this.photo,
        answers: answers ?? this.answers,
        parts: parts ?? this.parts,
        note: note ?? this.note,
        location: clearLocation ? null : (location ?? this.location),
        consent: consent ?? this.consent,
        phase: phase ?? this.phase,
        progress: progress ?? this.progress,
        error: clearError ? null : (error ?? this.error),
        diagnosisId: diagnosisId ?? this.diagnosisId,
      );
}

/// The crop-check flow: crop -> photo -> optional field details -> upload -> report.
class ScanController extends Notifier<ScanState> {
  CancelToken? _cancel;

  @override
  ScanState build() => const ScanState();

  void start(String cropId) => state = ScanState(cropId: cropId, consent: state.consent);
  void setPhoto(PickedPhoto photo) => state = state.copyWith(photo: photo, phase: UploadPhase.idle, clearError: true);
  void answer(String key, String? value) {
    final next = {...state.answers};
    if (value == null || next[key] == value) {
      next.remove(key);
    } else {
      next[key] = value;
    }
    state = state.copyWith(answers: next);
  }

  void togglePart(String part) =>
      state = state.copyWith(parts: state.parts.contains(part) ? (state.parts.where((p) => p != part).toList()) : [...state.parts, part]);
  void setNote(String note) => state = state.copyWith(note: note);
  void setLocation(({double latitude, double longitude, double accuracy})? location) =>
      state = location == null ? state.copyWith(clearLocation: true) : state.copyWith(location: location);
  void setConsent(bool value) => state = state.copyWith(consent: value);

  /// Device local time with its UTC offset, e.g. 2026-11-14T06:48:10+05:30 (as the web sends).
  static String deviceTimestamp(DateTime now) {
    final offset = now.timeZoneOffset;
    String two(int n) => n.abs().toString().padLeft(2, '0');
    final sign = offset.isNegative ? '-' : '+';
    final local = now.toIso8601String().split('.').first;
    return '$local$sign${two(offset.inHours)}:${two(offset.inMinutes.remainder(60))}';
  }

  Json? fieldContext({DateTime? now}) {
    final time = now ?? DateTime.now();
    return {
      'capturedAt': deviceTimestamp(time),
      'timeZone': time.timeZoneName,
      ...state.answers,
      if (state.parts.isNotEmpty) 'parts': state.parts,
      if (state.note.trim().isNotEmpty) 'note': state.note.trim(),
      if (state.location != null)
        'location': {'latitude': state.location!.latitude, 'longitude': state.location!.longitude, 'accuracyM': state.location!.accuracy},
    };
  }

  /// Uploads once. Never retried automatically — the farmer taps "Try again" (a blind retry
  /// after a timeout could create a duplicate report).
  Future<String?> submit() async {
    final photo = state.photo;
    final crop = state.cropId;
    if (photo == null || crop == null || state.busy) return null;
    _cancel = CancelToken();
    state = state.copyWith(phase: UploadPhase.uploading, progress: 0, clearError: true);
    try {
      final id = await ref.read(diagnosisRepositoryProvider).upload(
            DiagnosisUpload(
              cropId: crop,
              bytes: photo.bytes,
              filename: photo.filename,
              mimeType: photo.mimeType,
              consent: state.consent,
              fieldContext: fieldContext(),
              saveFarmLocation: state.location != null,
            ),
            cancelToken: _cancel,
            onProgress: (sent, total) {
              if (total <= 0) return;
              final p = sent / total;
              state = state.copyWith(progress: p, phase: p >= 1 ? UploadPhase.analysing : UploadPhase.uploading);
            },
          );
      state = state.copyWith(phase: UploadPhase.done, diagnosisId: id, progress: 1);
      return id;
    } on ApiException catch (e) {
      state = state.copyWith(phase: e.kind == ApiErrorKind.cancelled ? UploadPhase.idle : UploadPhase.failed, error: e);
      return null;
    }
  }

  void cancel() => _cancel?.cancel();
  void reset() => state = const ScanState();
}

final scanControllerProvider = NotifierProvider<ScanController, ScanState>(ScanController.new);
final photoServiceProvider = Provider<PhotoService>((ref) => PhotoService());
