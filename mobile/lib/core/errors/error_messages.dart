import '../localization/generated/app_localizations.dart';
import 'api_exception.dart';

/// Turns any error into one short, localised sentence for the farmer. Backend codes are mapped
/// to translated text; the backend's English message is only a last resort for English users.
String errorMessage(Object error, AppLocalizations l) {
  if (error is! ApiException) return l.errGeneric;
  final byCode = switch (error.code) {
    'OTP_INVALID' => l.otpErrInvalid,
    'OTP_EXPIRED' => l.otpErrExpired,
    'OTP_LOCKED' => l.otpErrLocked,
    'OTP_COOLDOWN' => l.otpErrCooldown,
    'OTP_RATE_LIMITED' => l.otpErrRateLimited,
    'OTP_NOT_CONFIGURED' => l.otpErrNotConfigured,
    'OTP_DEV_LOCALHOST_ONLY' => l.otpErrDevLocalhostOnly,
    'OTP_PHONE_NOT_ALLOWED' => l.otpErrPhoneNotAllowed,
    'OTP_RECIPIENT_NOT_ALLOWED' => l.otpErrRecipientNotAllowed,
    'OTP_COUNTRY_BLOCKED' || 'OTP_NUMBER_UNSUPPORTED' || 'OTP_DELIVERY_BLOCKED' => l.otpErrDelivery,
    'OTP_PROVIDER_ERROR' => l.otpErrProvider,
    'PHONE_INVALID' => l.phoneInvalid,
    'ACCOUNT_SUSPENDED' || 'ACCOUNT_DISABLED' || 'ACCOUNT_BLOCKED' => l.authErrBlocked,
    'ACCOUNT_PENDING' => l.authErrPending,
    'INFERENCE_OFFLINE' => l.errInferenceOffline,
    'MODEL_UNAVAILABLE' => l.errInferenceOffline,
    'MODEL_LOADING' => l.errModelLoading,
    'INFERENCE_BUSY' => l.errInferenceBusy,
    'INFERENCE_TIMEOUT' => l.errInferenceTimeout,
    'IMAGE_INVALID' || 'IMAGE_REQUIRED' => l.errImageInvalid,
    'IMAGE_FORMAT_UNSUPPORTED' => l.errImageFormat,
    'IMAGE_SIZE_INVALID' => l.errImageSize,
    'IMAGE_PIXEL_LIMIT' => l.errImagePixels,
    'IMAGE_DIMENSIONS_OR_ANIMATION_INVALID' => l.errImageDimensions,
    'CROP_UNSUPPORTED' => l.errCropUnsupported,
    'CROP_REQUIRED' => l.errCropRequired,
    'CONSENT_REQUIRED' => l.consentRequired,
    'DIAGNOSIS_FAILED' || 'INFERENCE_FAILED' => l.errDiagnosisFailed,
    'GENAI_NOT_CONFIGURED' => l.mitraNotConfigured,
    'VOICE_NOT_CONFIGURED' => l.voiceNotAvailable,
    'TOO_MANY_REQUESTS' => l.errRateLimited,
    _ => null,
  };
  if (byCode != null) return byCode;
  return switch (error.kind) {
    ApiErrorKind.offline => l.errOffline,
    ApiErrorKind.timeout => l.errTimeout,
    ApiErrorKind.unavailable => l.errUnavailable,
    ApiErrorKind.unauthorized => l.errSessionEnded,
    ApiErrorKind.forbidden => l.errForbidden,
    ApiErrorKind.notFound => l.errNotFound,
    ApiErrorKind.rateLimited => l.errRateLimited,
    _ => (l.localeName.startsWith('en') && (error.message?.isNotEmpty ?? false)) ? error.message! : l.errGeneric,
  };
}
