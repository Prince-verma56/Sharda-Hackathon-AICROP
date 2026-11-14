import '../../../core/utilities/json.dart';
import '../../../shared/models/farmer_models.dart';

/// GET /api/v1/farmer/diagnoses/:id — every number here is the stored model output or a stored
/// observation. Values the backend does not have (severity, heatmap) stay null/unavailable.
class FarmerReport {
  const FarmerReport({
    required this.id,
    required this.createdAt,
    required this.language,
    required this.imageUrl,
    required this.crop,
    required this.result,
    required this.model,
    required this.predictions,
    required this.explanation,
    required this.actions,
    required this.lookFor,
    required this.guidance,
    required this.references,
    required this.weather,
    required this.fieldNotes,
    required this.review,
    required this.feedbackHelpful,
    required this.history,
    required this.heatmapAvailable,
    required this.heatmapReason,
    required this.speechText,
    required this.speechLocale,
    required this.shareText,
    required this.askMitra,
    required this.disclaimer,
    required this.raw,
  });

  final String id;
  final DateTime createdAt;
  final String language;
  final String imageUrl;
  final ReportCrop crop;
  final ReportResult result;
  final ReportModel model;
  final List<Prediction> predictions;
  final Explanation? explanation;
  final List<ReportAction> actions;
  final LookFor lookFor;
  final Guidance? guidance;
  final List<ReferencePhoto> references;
  final WeatherSnapshot? weather;
  final FieldNotes? fieldNotes;
  final ReviewInfo review;
  final bool? feedbackHelpful;
  final List<HistoryPoint> history;
  final bool heatmapAvailable;
  final String? heatmapReason;
  final String speechText;
  final String speechLocale;
  final String shareText;
  final List<String> askMitra;
  final String disclaimer;
  /// original JSON, kept for the offline copy
  final Json raw;

  factory FarmerReport.fromJson(Json j) {
    final heatmap = j.obj('heatmap') ?? const {};
    final speech = j.obj('speech') ?? const {};
    return FarmerReport(
      id: j.str('id'),
      createdAt: j.date('createdAt') ?? DateTime.now(),
      language: j.strOrNull('language') ?? 'en',
      imageUrl: j.obj('image')?.strOrNull('url') ?? '/api/v1/images/diagnoses/${j.str('id')}',
      crop: ReportCrop.fromJson(j.obj('crop') ?? const {'id': 'unknown'}),
      result: ReportResult.fromJson(j.obj('result') ?? const {}),
      model: ReportModel.fromJson(j.obj('model') ?? const {}),
      predictions: j.objects('predictions').map(Prediction.fromJson).toList()..sort((a, b) => a.rank.compareTo(b.rank)),
      explanation: j.obj('explanation') == null ? null : Explanation.fromJson(j.obj('explanation')!),
      actions: j.objects('actions').map(ReportAction.fromJson).toList(),
      lookFor: LookFor.fromJson(j.obj('lookFor') ?? const {}),
      guidance: j.obj('guidance') == null ? null : Guidance.fromJson(j.obj('guidance')!),
      references: j.objects('references').map(ReferencePhoto.fromJson).toList(),
      weather: j.obj('weather') == null ? null : WeatherSnapshot.fromJson(j.obj('weather')!),
      fieldNotes: j.obj('fieldNotes') == null ? null : FieldNotes.fromJson(j.obj('fieldNotes')!),
      review: ReviewInfo.fromJson(j.obj('review') ?? const {}),
      feedbackHelpful: j.obj('feedback')?.boolean('helpful'),
      history: j.objects('history').map(HistoryPoint.fromJson).toList(),
      heatmapAvailable: heatmap.boolean('available'),
      heatmapReason: heatmap.strOrNull('reason'),
      speechText: speech.strOrNull('text') ?? '',
      speechLocale: speech.strOrNull('locale') ?? 'en-IN',
      shareText: j.strOrNull('shareText') ?? '',
      askMitra: j.strings('askMitra'),
      disclaimer: j.strOrNull('disclaimer') ?? '',
      raw: j,
    );
  }
}

class ReportCrop {
  const ReportCrop({required this.id, required this.name, this.imageUrl, this.selectedName, required this.source});
  final String id;
  final String name;
  final String? imageUrl;
  final String? selectedName;
  /// "user" (farmer chose it) or "model" (crop predicted, e.g. "I don't know the crop")
  final String source;
  bool get detectedByModel => source == 'model';
  factory ReportCrop.fromJson(Json j) => ReportCrop(
        id: j.strOrNull('id') ?? 'unknown',
        name: j.strOrNull('name') ?? j.strOrNull('id') ?? '',
        imageUrl: j.strOrNull('imageUrl'),
        selectedName: j.obj('selected')?.strOrNull('name'),
        source: j.strOrNull('source') ?? 'user',
      );
}

class Advisory {
  const Advisory(this.code, this.label);
  final String code;
  final String label;
}

class ReportResult {
  const ReportResult({
    required this.label,
    required this.condition,
    required this.isHealthy,
    required this.score,
    required this.scorePercent,
    required this.photoQuality,
    required this.advisories,
    required this.uncertain,
    required this.severity,
  });
  final String label;
  final String condition;
  final bool isHealthy;
  final double score;
  final int scorePercent;
  final String photoQuality;
  final List<Advisory> advisories;
  final bool uncertain;
  /// Always null today: no validated severity estimate exists.
  final String? severity;

  factory ReportResult.fromJson(Json j) => ReportResult(
        label: j.strOrNull('label') ?? '',
        condition: j.strOrNull('condition') ?? '',
        isHealthy: j.boolean('isHealthy'),
        score: j.dbl('score'),
        scorePercent: j.intOrNull('scorePercent') ?? (j.dbl('score') * 100).round(),
        photoQuality: j.strOrNull('photoQuality') ?? 'ok',
        advisories: j.objects('advisories').map((a) => Advisory(a.strOrNull('code') ?? '', a.strOrNull('label') ?? a.strOrNull('code') ?? '')).toList(),
        uncertain: j.boolean('uncertain'),
        severity: j.strOrNull('severity'),
      );
}

class ReportModel {
  const ReportModel({required this.name, required this.version});
  final String name;
  final String version;
  factory ReportModel.fromJson(Json j) => ReportModel(name: j.strOrNull('name') ?? 'AgriSmart India', version: j.strOrNull('version') ?? '');
}

class Prediction {
  const Prediction({required this.rank, required this.condition, required this.crop, required this.score, required this.isHealthy});
  final int rank;
  final String condition;
  final String crop;
  final double score;
  final bool isHealthy;
  factory Prediction.fromJson(Json j) =>
      Prediction(rank: j.integer('rank'), condition: j.strOrNull('condition') ?? '', crop: j.strOrNull('crop') ?? '', score: j.dbl('score'), isHealthy: j.boolean('isHealthy'));
}

class Explanation {
  const Explanation({required this.source, required this.summary, required this.conditionExplanation, required this.possibleCauses, required this.sources});
  final String source;
  final String summary;
  final String conditionExplanation;
  final List<String> possibleCauses;
  final List<({String title, String? url})> sources;
  factory Explanation.fromJson(Json j) => Explanation(
        source: j.strOrNull('source') ?? 'none',
        summary: j.strOrNull('summary') ?? '',
        conditionExplanation: j.strOrNull('conditionExplanation') ?? '',
        possibleCauses: j.strings('possibleCauses'),
        sources: j.objects('sources').map((s) => (title: s.strOrNull('title') ?? '', url: s.strOrNull('url'))).toList(),
      );
}

enum ActionKind { inspect, prevent, expert, test }

class ReportAction {
  const ReportAction({required this.step, required this.kind, required this.text});
  final int step;
  final ActionKind kind;
  final String text;
  factory ReportAction.fromJson(Json j) => ReportAction(
        step: j.integer('step'),
        kind: ActionKind.values.firstWhere((k) => k.name == j.strOrNull('kind'), orElse: () => ActionKind.inspect),
        text: j.strOrNull('text') ?? '',
      );
}

class LookFor {
  const LookFor({required this.approved, required this.items});
  /// true = expert-approved symptoms; false = general scouting steps
  final bool approved;
  final List<String> items;
  factory LookFor.fromJson(Json j) => LookFor(approved: j.strOrNull('kind') == 'approved_symptoms', items: j.strings('items'));
}

class Guidance {
  const Guidance({required this.title, this.sourceUrl, this.sourceOrganisation, this.lastReviewedAt});
  final String title;
  final String? sourceUrl;
  final String? sourceOrganisation;
  final DateTime? lastReviewedAt;
  factory Guidance.fromJson(Json j) =>
      Guidance(title: j.strOrNull('title') ?? '', sourceUrl: j.strOrNull('sourceUrl'), sourceOrganisation: j.strOrNull('sourceOrganisation'), lastReviewedAt: j.date('lastReviewedAt'));
}

class ReferencePhoto {
  const ReferencePhoto({required this.kind, required this.label, this.imageUrl, this.credit});
  /// "condition" or "healthy"
  final String kind;
  final String label;
  final String? imageUrl;
  final String? credit;
  factory ReferencePhoto.fromJson(Json j) =>
      ReferencePhoto(kind: j.strOrNull('kind') ?? 'condition', label: j.strOrNull('label') ?? '', imageUrl: j.strOrNull('imageUrl'), credit: j.strOrNull('credit'));
}

class FieldNotes {
  const FieldNotes({required this.items, this.note, this.capturedAt, this.latitude, this.longitude});
  final List<({String key, String label, String value})> items;
  final String? note;
  final String? capturedAt;
  final double? latitude;
  final double? longitude;
  factory FieldNotes.fromJson(Json j) => FieldNotes(
        items: j.objects('items').map((i) => (key: i.strOrNull('key') ?? '', label: i.strOrNull('label') ?? '', value: i.strOrNull('value') ?? '')).toList(),
        note: j.strOrNull('note'),
        capturedAt: j.strOrNull('capturedAt'),
        latitude: j.obj('location')?.dblOrNull('latitude'),
        longitude: j.obj('location')?.dblOrNull('longitude'),
      );
  bool get isEmpty => items.isEmpty && (note == null || note!.isEmpty) && capturedAt == null && latitude == null;
}

class ReviewInfo {
  const ReviewInfo({required this.status, this.verdict, this.note, this.correctedCondition});
  /// UNREVIEWED | PENDING | CONFIRMED | CHALLENGED | NEEDS_INFO
  final String status;
  final String? verdict;
  final String? note;
  final String? correctedCondition;
  factory ReviewInfo.fromJson(Json j) {
    final latest = j.obj('latest');
    return ReviewInfo(
      status: j.strOrNull('status') ?? 'UNREVIEWED',
      verdict: latest?.strOrNull('verdict'),
      note: latest?.strOrNull('note'),
      correctedCondition: latest?.strOrNull('correctedCondition'),
    );
  }
}

class HistoryPoint {
  const HistoryPoint({required this.id, required this.createdAt, required this.condition, required this.score, required this.isHealthy, required this.current});
  final String id;
  final DateTime createdAt;
  final String condition;
  final double score;
  final bool isHealthy;
  final bool current;
  factory HistoryPoint.fromJson(Json j) => HistoryPoint(
        id: j.str('id'),
        createdAt: j.date('createdAt') ?? DateTime.now(),
        condition: j.strOrNull('condition') ?? '',
        score: j.dbl('score'),
        isHealthy: j.boolean('isHealthy'),
        current: j.boolean('current'),
      );
}
