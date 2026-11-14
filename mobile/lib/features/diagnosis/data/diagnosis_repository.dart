import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/storage/prefs_store.dart';
import '../../../core/utilities/json.dart';
import 'report_models.dart';

/// What the review screen sends. The photo is the farmer's real image (resized on the phone to a
/// 1600 px long edge / JPEG q90 — the same as the web client — and decoded again by the server).
class DiagnosisUpload {
  const DiagnosisUpload({
    required this.cropId,
    required this.bytes,
    required this.filename,
    required this.mimeType,
    required this.consent,
    this.fieldContext,
    this.saveFarmLocation = false,
  });

  /// a crop id from /api/v1/farmer/crops, or "auto" (model predicts the crop too)
  final String cropId;
  final Uint8List bytes;
  final String filename;
  final String mimeType;
  final bool consent;
  final Json? fieldContext;
  final bool saveFarmLocation;
}

class LoadedReport {
  const LoadedReport(this.report, {this.savedAt});
  final FarmerReport report;
  /// set when shown from the offline copy
  final DateTime? savedAt;
}

class DiagnosisRepository {
  DiagnosisRepository(this._api, this._prefs);
  final ApiClient _api;
  final PrefsStore _prefs;

  static const _indexKey = 'reports.index';
  static const _maxCached = 10;

  /// Upload -> REAL AgriSmart inference (FastAPI, behind Next.js) -> stored report. Returns its id.
  Future<String> upload(DiagnosisUpload request, {void Function(int sent, int total)? onProgress, CancelToken? cancelToken}) {
    final type = request.mimeType.split('/');
    return _api.upload(
      '/api/v1/farmer/diagnoses',
      cancelToken: cancelToken,
      onSendProgress: onProgress,
      form: () => FormData.fromMap({
        'image': MultipartFile.fromBytes(request.bytes, filename: request.filename, contentType: DioMediaType(type.first, type.last)),
        'crop': request.cropId,
        if (request.consent) 'consent': 'true',
        if (request.fieldContext != null) 'context': jsonEncode({...request.fieldContext!, if (request.saveFarmLocation) 'saveFarmLocation': true}),
      }),
      parse: (d) => asJson(d).str('id'),
    );
  }

  /// The report in [lang]; falls back to the saved copy when the server cannot be reached.
  Future<LoadedReport> report(String id, String lang) async {
    try {
      final json = await _api.get('/api/v1/farmer/diagnoses/$id', query: {'lang': lang}, parse: asJson);
      final report = FarmerReport.fromJson(json);
      await _remember(id, json);
      return LoadedReport(report);
    } on ApiException catch (e) {
      if (!e.isTransient) rethrow;
      final cached = await _prefs.readCache('report.$id');
      if (cached?.data is Map) return LoadedReport(FarmerReport.fromJson(asJson(cached!.data)), savedAt: cached.savedAt);
      rethrow;
    }
  }

  Future<void> feedback(String id, {required bool helpful, String? comment}) => _api.post(
        '/api/v1/farmer/diagnoses/$id/actions',
        body: {'action': 'feedback', 'helpful': helpful, if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim()},
        parse: (d) => d,
      );

  /// Returns the resulting review status (PENDING, or CONFIRMED/CHALLENGED if already reviewed).
  Future<String> requestExpert(String id) => _api.post(
        '/api/v1/farmer/diagnoses/$id/actions',
        body: {'action': 'request_expert'},
        parse: (d) => asJson(d).strOrNull('status') ?? 'PENDING',
      );

  Future<void> _remember(String id, Json json) async {
    await _prefs.writeCache('report.$id', json);
    final index = await _prefs.readCache(_indexKey);
    final ids = [id, ...(index?.data is List ? (index!.data! as List).whereType<String>().where((x) => x != id) : const <String>[])];
    for (final stale in ids.skip(_maxCached)) {
      await _prefs.writeCache('report.$stale', null);
    }
    await _prefs.writeCache(_indexKey, ids.take(_maxCached).toList());
  }
}

final diagnosisRepositoryProvider = Provider<DiagnosisRepository>((ref) => DiagnosisRepository(ref.watch(apiClientProvider), ref.watch(prefsStoreProvider)));
