import '../../core/utilities/json.dart';

/// Shapes returned by the farmer APIs (see docs/mobile/00-backend-api-audit.md).

class CropRef {
  const CropRef({required this.id, required this.name, this.imageUrl});
  final String id;
  final String name;
  final String? imageUrl;
  factory CropRef.fromJson(Json j) => CropRef(id: j.str('id'), name: j.strOrNull('name') ?? j.str('id'), imageUrl: j.strOrNull('imageUrl'));
}

class WeatherDay {
  const WeatherDay({required this.date, this.maxC, this.minC, this.rainMm, this.rainChancePct});
  final DateTime date;
  final double? maxC;
  final double? minC;
  final double? rainMm;
  final double? rainChancePct;
  factory WeatherDay.fromJson(Json j) => WeatherDay(
        date: j.date('date') ?? DateTime.now(),
        maxC: j.dblOrNull('maxC'),
        minC: j.dblOrNull('minC'),
        rainMm: j.dblOrNull('rainMm'),
        rainChancePct: j.dblOrNull('rainChancePct'),
      );
}

class WeatherSnapshot {
  const WeatherSnapshot({
    required this.provider,
    required this.observedAt,
    this.temperatureC,
    this.humidityPct,
    this.rainLast24hMm,
    this.rainLast72hMm,
    this.forecast = const [],
    this.note,
  });
  final String provider;
  final DateTime? observedAt;
  final double? temperatureC;
  final double? humidityPct;
  final double? rainLast24hMm;
  final double? rainLast72hMm;
  final List<WeatherDay> forecast;
  final String? note;

  factory WeatherSnapshot.fromJson(Json j) => WeatherSnapshot(
        provider: j.strOrNull('provider') ?? 'open-meteo',
        observedAt: j.date('observedAt'),
        temperatureC: j.dblOrNull('temperatureC'),
        humidityPct: j.dblOrNull('humidityPct'),
        rainLast24hMm: j.dblOrNull('rainLast24hMm'),
        rainLast72hMm: j.dblOrNull('rainLast72hMm'),
        forecast: j.objects('forecast').map(WeatherDay.fromJson).toList(),
        note: j.strOrNull('note'),
      );

  String get providerLabel => provider == 'open-meteo' ? 'Open-Meteo' : provider;
}

class CheckSummary {
  const CheckSummary({
    required this.id,
    required this.createdAt,
    required this.crop,
    required this.condition,
    required this.isHealthy,
    required this.score,
    this.reviewStatus,
    this.thumbnailUrl,
    this.uncertain = false,
  });
  final String id;
  final DateTime createdAt;
  final CropRef crop;
  final String condition;
  final bool isHealthy;
  final double score;
  final String? reviewStatus;
  final String? thumbnailUrl;
  final bool uncertain;

  factory CheckSummary.fromJson(Json j) => CheckSummary(
        id: j.str('id'),
        createdAt: j.date('createdAt') ?? DateTime.now(),
        crop: CropRef.fromJson(j.obj('crop') ?? const {'id': 'unknown'}),
        condition: j.strOrNull('condition') ?? '',
        isHealthy: j.boolean('isHealthy'),
        score: j.dbl('score'),
        reviewStatus: j.strOrNull('reviewStatus'),
        thumbnailUrl: j.strOrNull('thumbnailUrl'),
        uncertain: j.boolean('uncertain'),
      );
}

class HomeVideo {
  const HomeVideo({required this.id, required this.title, this.thumbnailUrl, required this.streamUrl});
  final String id;
  final String title;
  final String? thumbnailUrl;
  final String streamUrl;
  factory HomeVideo.fromJson(Json j) => HomeVideo(id: j.str('id'), title: j.strOrNull('title') ?? '', thumbnailUrl: j.strOrNull('thumbnailUrl'), streamUrl: j.strOrNull('streamUrl') ?? '');
}

class HomeData {
  const HomeData({
    required this.preferredName,
    required this.notice,
    required this.unreadNotifications,
    required this.checks,
    required this.latest,
    required this.crops,
    required this.farmLabel,
    required this.weather,
    required this.weatherStatus,
    required this.videos,
  });
  final String? preferredName;
  final String? notice;
  final int unreadNotifications;
  final int checks;
  final CheckSummary? latest;
  final List<CropRef> crops;
  final String? farmLabel;
  final WeatherSnapshot? weather;
  /// ok | unavailable | no_location
  final String weatherStatus;
  final List<HomeVideo> videos;

  factory HomeData.fromJson(Json j) => HomeData(
        preferredName: j.strOrNull('preferredName'),
        notice: j.strOrNull('notice'),
        unreadNotifications: j.integer('unreadNotifications'),
        checks: j.integer('checks'),
        latest: j.obj('latest') == null ? null : CheckSummary.fromJson(j.obj('latest')!),
        crops: j.objects('crops').map(CropRef.fromJson).toList(),
        farmLabel: j.obj('farm')?.strOrNull('label'),
        weather: j.obj('weather') == null ? null : WeatherSnapshot.fromJson(j.obj('weather')!),
        weatherStatus: j.strOrNull('weatherStatus') ?? 'no_location',
        videos: j.objects('videos').map(HomeVideo.fromJson).toList(),
      );
}

// ---- crops catalogue -------------------------------------------------------------------------

class CropOption {
  const CropOption({required this.id, required this.nameEn, required this.nameHi, this.imageUrl, required this.classCount});
  final String id;
  final String nameEn;
  final String nameHi;
  final String? imageUrl;
  final int classCount;
  String name(String lang) => lang == 'hi' ? nameHi : nameEn;
  bool matches(String query) {
    final q = query.trim().toLowerCase();
    return q.isEmpty || nameEn.toLowerCase().contains(q) || nameHi.contains(q) || id.contains(q);
  }

  factory CropOption.fromJson(Json j) {
    final name = j.obj('name') ?? const {};
    return CropOption(
      id: j.str('id'),
      nameEn: name.strOrNull('en') ?? j.str('id'),
      nameHi: name.strOrNull('hi') ?? name.strOrNull('en') ?? j.str('id'),
      imageUrl: j.strOrNull('imageUrl'),
      classCount: j.integer('classCount'),
    );
  }
}

class SamplePhoto {
  const SamplePhoto({required this.file, required this.crop, required this.condition, required this.url, required this.credit});
  final String file;
  final String crop;
  final String condition;
  final String url;
  final String credit;
  factory SamplePhoto.fromJson(Json j) =>
      SamplePhoto(file: j.str('file'), crop: j.str('crop'), condition: j.strOrNull('condition') ?? '', url: j.str('url'), credit: j.strOrNull('credit') ?? '');
}

class ChoiceOption {
  const ChoiceOption({required this.id, required this.en, required this.hi});
  final String id;
  final String en;
  final String hi;
  String label(String lang) => lang == 'hi' ? hi : en;
}

class FieldQuestion {
  const FieldQuestion({required this.key, required this.labelEn, required this.labelHi, required this.options, required this.multiple});
  final String key;
  final String labelEn;
  final String labelHi;
  final List<ChoiceOption> options;
  final bool multiple;
  String label(String lang) => lang == 'hi' ? labelHi : labelEn;
}

class CropCatalogue {
  const CropCatalogue({
    required this.modelVersion,
    required this.crops,
    required this.mine,
    required this.popular,
    required this.samples,
    required this.questions,
    required this.autoCrop,
  });
  final String modelVersion;
  final List<CropOption> crops;
  final List<String> mine;
  final List<String> popular;
  final List<SamplePhoto> samples;
  final List<FieldQuestion> questions;
  final bool autoCrop;

  CropOption? byId(String id) {
    for (final c in crops) {
      if (c.id == id) return c;
    }
    return null;
  }

  factory CropCatalogue.fromJson(Json j) {
    final details = j.obj('fieldDetails') ?? const {};
    final labels = details.obj('labels') ?? const {};
    final options = details.obj('options') ?? const {};
    final multiple = details.strings('multiple');
    return CropCatalogue(
      modelVersion: j.strOrNull('modelVersion') ?? '',
      crops: j.objects('crops').map(CropOption.fromJson).toList(),
      mine: j.strings('mine'),
      popular: j.strings('popular'),
      samples: j.objects('samples').map(SamplePhoto.fromJson).toList(),
      autoCrop: j.boolean('autoCrop'),
      questions: [
        for (final key in options.keys)
          FieldQuestion(
            key: key,
            labelEn: labels.obj(key)?.strOrNull('en') ?? key,
            labelHi: labels.obj(key)?.strOrNull('hi') ?? key,
            multiple: multiple.contains(key),
            options: options.objects(key).map((o) => ChoiceOption(id: o.str('id'), en: o.strOrNull('en') ?? o.str('id'), hi: o.strOrNull('hi') ?? o.str('id'))).toList(),
          ),
      ],
    );
  }
}
