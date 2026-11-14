/// Build-time configuration (`--dart-define` / `--dart-define-from-file=config/<env>.json`).
///
/// Only PUBLIC values belong here: anything compiled into the APK can be extracted from it.
/// The app talks to exactly one origin — the CropAI Next.js API gateway — never to FastAPI,
/// PostgreSQL or Redis directly.
library;

enum AppEnvironment { development, staging, production }

class AppConfig {
  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.appName,
    required this.allowLoopback,
  });

  final AppEnvironment environment;

  /// Origin of the Next.js backend, e.g. http://192.168.1.10:3000 (phone on the same Wi-Fi),
  /// http://10.0.2.2:3000 (Android emulator) or https://cropai.example.in (staging/production).
  final Uri apiBaseUrl;
  final String appName;

  /// Development only: allow http://localhost (USB `adb reverse tcp:3000 tcp:3000`).
  final bool allowLoopback;

  bool get isProduction => environment == AppEnvironment.production;
  bool get usesHttps => apiBaseUrl.scheme == 'https';

  static const String _rawBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String _rawEnvironment = String.fromEnvironment('APP_ENV', defaultValue: 'development');
  static const String _appName = String.fromEnvironment('APP_NAME', defaultValue: 'CropAI');
  static const bool _allowLoopback = bool.fromEnvironment('ALLOW_LOOPBACK');

  /// Reads and validates the compiled-in values. Never throws: errors are shown on a setup screen.
  static AppConfigResult fromEnvironment() =>
      parse(rawBaseUrl: _rawBaseUrl, rawEnvironment: _rawEnvironment, appName: _appName, allowLoopback: _allowLoopback);

  static AppConfigResult parse({
    required String rawBaseUrl,
    required String rawEnvironment,
    String appName = 'CropAI',
    bool allowLoopback = false,
  }) {
    final errors = <String>[];
    final environment = switch (rawEnvironment.trim().toLowerCase()) {
      'development' || 'dev' => AppEnvironment.development,
      'staging' || 'preview' => AppEnvironment.staging,
      'production' || 'prod' => AppEnvironment.production,
      _ => null,
    };
    if (environment == null) errors.add('APP_ENV must be development, staging or production (got "$rawEnvironment").');

    final trimmed = rawBaseUrl.trim();
    Uri? uri;
    if (trimmed.isEmpty) {
      errors.add('API_BASE_URL is missing. Build with --dart-define-from-file=config/dev.local.json (see mobile/README.md).');
    } else {
      uri = Uri.tryParse(trimmed);
      if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
        errors.add('API_BASE_URL must be an absolute URL such as http://192.168.1.10:3000.');
        uri = null;
      } else if (uri.scheme != 'http' && uri.scheme != 'https') {
        errors.add('API_BASE_URL must use http or https.');
      } else if (uri.hasQuery || uri.hasFragment || (uri.path.isNotEmpty && uri.path != '/')) {
        errors.add('API_BASE_URL must be an origin only (no path, query or fragment).');
      }
    }

    if (uri != null && environment != null) {
      if (environment != AppEnvironment.development && uri.scheme != 'https') {
        errors.add('${environment.name} builds must use an https:// API_BASE_URL.');
      }
      if (_isLoopback(uri.host) && !(environment == AppEnvironment.development && allowLoopback)) {
        errors.add('API_BASE_URL points at ${uri.host}, which on a phone means the phone itself. '
            'Use your computer\'s Wi-Fi IP (http://192.168.x.x:3000), 10.0.2.2 for the emulator, '
            'or ALLOW_LOOPBACK=true with `adb reverse tcp:3000 tcp:3000`.');
      }
    }

    if (errors.isNotEmpty) return AppConfigError(errors);
    final origin = uri!.replace(path: '');
    return AppConfigOk(AppConfig(
      environment: environment!,
      apiBaseUrl: origin,
      appName: appName.trim().isEmpty ? 'CropAI' : appName.trim(),
      allowLoopback: allowLoopback,
    ));
  }

  static bool _isLoopback(String host) => host == 'localhost' || host == '127.0.0.1' || host == '::1' || host == '[::1]';
}

sealed class AppConfigResult {
  const AppConfigResult();
}

class AppConfigOk extends AppConfigResult {
  const AppConfigOk(this.config);
  final AppConfig config;
}

class AppConfigError extends AppConfigResult {
  const AppConfigError(this.errors);
  final List<String> errors;
}
