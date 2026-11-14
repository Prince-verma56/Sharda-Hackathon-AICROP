import 'package:intl/intl.dart';

/// Locale-aware formatting helpers (dates in the farmer's language, Indian conventions).
abstract final class Fmt {
  static String _intlLocale(String code) => code == 'hi' ? 'hi_IN' : 'en_IN';

  static String dateTime(DateTime value, String locale) => DateFormat.yMMMd(_intlLocale(locale)).add_jm().format(value.toLocal());
  static String date(DateTime value, String locale) => DateFormat.yMMMd(_intlLocale(locale)).format(value.toLocal());
  static String weekday(DateTime value, String locale) => DateFormat.E(_intlLocale(locale)).format(value);
  static String time(DateTime value, String locale) => DateFormat.jm(_intlLocale(locale)).format(value.toLocal());

  static String percent(double score) => '${(score * 100).round()}%';

  static String bytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  static String number(num? value, {int digits = 1}) {
    if (value == null) return '—';
    return value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(digits);
  }

  /// "+919876543210" -> "+91 98•••••210" (never show a full number in UI logs/screens).
  static String maskPhone(String e164) {
    if (e164.length < 8) return '•••';
    return '${e164.substring(0, 3)} ${e164.substring(3, 5)}•••••${e164.substring(e164.length - 3)}';
  }
}

/// Indian mobile numbers: 10 digits starting 6-9, optionally with +91 / 0 prefixes.
abstract final class PhoneInput {
  static String? normalise(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9+]'), '');
    if (RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(digits)) {
      return digits.startsWith('+91') && !RegExp(r'^\+91[6-9]\d{9}$').hasMatch(digits) ? null : digits;
    }
    // Strip a prefix only when the length shows one is present: "09876543210", "919876543210".
    // (A plain 10-digit number may itself start with 91, e.g. 9123456789.)
    final local = digits.length == 11 && digits.startsWith('0')
        ? digits.substring(1)
        : digits.length == 12 && digits.startsWith('91')
            ? digits.substring(2)
            : digits;
    return RegExp(r'^[6-9]\d{9}$').hasMatch(local) ? '+91$local' : null;
  }
}
