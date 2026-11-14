/// Defensive JSON readers: the app should degrade (null / empty) on unexpected shapes instead
/// of crashing, while required fields still throw a clear FormatException.
typedef Json = Map<String, Object?>;

Json asJson(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return value.cast<String, Object?>();
  throw FormatException('Expected a JSON object, got ${value.runtimeType}');
}

extension JsonRead on Json {
  String str(String key) {
    final v = this[key];
    if (v is String) return v;
    throw FormatException('Missing string "$key"');
  }

  String? strOrNull(String key) => this[key] is String ? this[key]! as String : null;
  int integer(String key, [int fallback = 0]) => this[key] is num ? (this[key]! as num).toInt() : fallback;
  int? intOrNull(String key) => this[key] is num ? (this[key]! as num).toInt() : null;
  double dbl(String key, [double fallback = 0]) => this[key] is num ? (this[key]! as num).toDouble() : fallback;
  double? dblOrNull(String key) => this[key] is num ? (this[key]! as num).toDouble() : null;
  bool boolean(String key, [bool fallback = false]) => this[key] is bool ? this[key]! as bool : fallback;
  DateTime? date(String key) => this[key] is String ? DateTime.tryParse(this[key]! as String) : null;
  Json? obj(String key) => this[key] is Map ? asJson(this[key]) : null;
  List<Json> objects(String key) => this[key] is List ? [for (final e in this[key]! as List) if (e is Map) asJson(e)] : const [];
  List<String> strings(String key) => this[key] is List ? [for (final e in this[key]! as List) if (e is String) e] : const [];
}
