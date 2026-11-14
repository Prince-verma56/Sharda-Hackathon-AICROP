/// Identity as the backend resolves it from PostgreSQL (GET /api/v1/auth/me). Roles and
/// workspaces are decided by the server; the app only hides what the server did not grant.
class Me {
  const Me({
    required this.userId,
    required this.phoneMasked,
    required this.name,
    required this.roles,
    required this.workspaces,
    required this.farmer,
    required this.volunteer,
  });

  final String userId;
  final String phoneMasked;
  final String? name;
  final List<String> roles;
  final List<String> workspaces;
  final FarmerSummary? farmer;
  final VolunteerSummary? volunteer;

  bool get isFarmer => workspaces.contains('farmer') && farmer != null;
  bool get hasVolunteerWorkspace => workspaces.contains('volunteer') && volunteer != null;

  factory Me.fromJson(Map<String, Object?> j) => Me(
        userId: j['userId']! as String,
        phoneMasked: (j['phoneMasked'] as String?) ?? '',
        name: j['name'] as String?,
        roles: [...(j['roles'] as List? ?? const []).cast<String>()],
        workspaces: [...(j['workspaces'] as List? ?? const []).cast<String>()],
        farmer: j['farmer'] is Map ? FarmerSummary.fromJson((j['farmer']! as Map).cast<String, Object?>()) : null,
        volunteer: j['volunteer'] is Map ? VolunteerSummary.fromJson((j['volunteer']! as Map).cast<String, Object?>()) : null,
      );

  /// Non-sensitive subset kept on the device so the app can open offline.
  Map<String, Object?> toCacheJson() => {
        'userId': userId,
        'phoneMasked': phoneMasked,
        'name': name,
        'roles': roles,
        'workspaces': workspaces,
        'farmer': farmer?.toJson(),
        'volunteer': volunteer?.toJson(),
      };
}

class FarmerSummary {
  const FarmerSummary({required this.preferredName, required this.language, required this.onboarded});
  final String? preferredName;
  final String language;
  final bool onboarded;

  factory FarmerSummary.fromJson(Map<String, Object?> j) => FarmerSummary(
        preferredName: j['preferredName'] as String?,
        language: (j['language'] as String?) ?? 'en',
        onboarded: j['onboarded'] == true,
      );
  Map<String, Object?> toJson() => {'preferredName': preferredName, 'language': language, 'onboarded': onboarded};
}

class VolunteerSummary {
  const VolunteerSummary({required this.serviceArea, required this.verificationStatus, required this.trainingStatus, required this.profileComplete});
  final String? serviceArea;
  final String verificationStatus;
  final String trainingStatus;
  final bool profileComplete;

  factory VolunteerSummary.fromJson(Map<String, Object?> j) => VolunteerSummary(
        serviceArea: j['serviceArea'] as String?,
        verificationStatus: (j['verificationStatus'] as String?) ?? 'PENDING',
        trainingStatus: (j['trainingStatus'] as String?) ?? 'NOT_STARTED',
        profileComplete: j['profileComplete'] == true,
      );
  Map<String, Object?> toJson() =>
      {'serviceArea': serviceArea, 'verificationStatus': verificationStatus, 'trainingStatus': trainingStatus, 'profileComplete': profileComplete};
}

class OtpChallenge {
  const OtpChallenge({required this.phoneE164, required this.expiresInSeconds, required this.resendAfterSeconds, required this.development});
  final String phoneE164;
  final int expiresInSeconds;
  final int resendAfterSeconds;
  /// true when the server uses its development OTP provider (no SMS was sent).
  final bool development;
}

/// Public facts from GET /api/v1/mobile/config.
class MobileConfig {
  const MobileConfig({required this.brandName, required this.assistantName, required this.otpMode, required this.voiceAvailable, this.supportEmail, required this.links});
  final String brandName;
  final String assistantName;
  final String otpMode;
  final bool voiceAvailable;
  final String? supportEmail;
  final Map<String, String> links;

  static const fallback = MobileConfig(brandName: 'CropAI', assistantName: 'Mitra', otpMode: 'sms', voiceAvailable: false, links: {
    'privacyPolicy': '/privacy-policy',
    'terms': '/terms-and-conditions',
    'dataRights': '/data-rights',
    'resources': '/resources',
  });

  factory MobileConfig.fromJson(Map<String, Object?> j) {
    final brand = (j['brand'] as Map?)?.cast<String, Object?>() ?? const {};
    final auth = (j['auth'] as Map?)?.cast<String, Object?>() ?? const {};
    final voice = (j['voice'] as Map?)?.cast<String, Object?>() ?? const {};
    final support = (j['support'] as Map?)?.cast<String, Object?>() ?? const {};
    final links = (j['links'] as Map?)?.cast<String, Object?>() ?? const {};
    return MobileConfig(
      brandName: (brand['name'] as String?) ?? 'CropAI',
      assistantName: (brand['assistantName'] as String?) ?? 'Mitra',
      otpMode: (auth['otpMode'] as String?) ?? 'sms',
      voiceAvailable: voice['available'] == true,
      supportEmail: support['email'] as String?,
      links: {for (final e in links.entries) if (e.value is String) e.key: e.value! as String},
    );
  }
}
