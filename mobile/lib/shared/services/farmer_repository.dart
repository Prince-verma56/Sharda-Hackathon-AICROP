import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/api_exception.dart';
import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import '../../core/storage/prefs_store.dart';
import '../../core/utilities/json.dart';
import '../models/farmer_models.dart';

class Cached<T> {
  const Cached(this.value, {this.savedAt});
  final T value;
  /// non-null when the value came from the on-device copy (offline)
  final DateTime? savedAt;
}

class HistoryPage {
  const HistoryPage({required this.items, required this.total, required this.nextCursor});
  final List<CheckSummary> items;
  final int total;
  final String? nextCursor;
}

class PlaceResult {
  const PlaceResult({required this.label, required this.latitude, required this.longitude, this.district, this.state});
  final String label;
  final double latitude;
  final double longitude;
  final String? district;
  final String? state;
}

class FarmerProfileData {
  const FarmerProfileData({
    required this.phoneMasked,
    required this.preferredName,
    required this.language,
    required this.state,
    required this.district,
    required this.village,
    required this.mainCrops,
    required this.voiceEnabled,
    required this.onboarded,
    required this.location,
    required this.photoConsent,
    required this.chatHistoryConsent,
    required this.voiceTranscriptConsent,
  });
  final String phoneMasked;
  final String? preferredName;
  final String language;
  final String? state;
  final String? district;
  final String? village;
  final List<CropRef> mainCrops;
  final bool voiceEnabled;
  final bool onboarded;
  final PlaceResult? location;
  final bool photoConsent;
  final bool chatHistoryConsent;
  final bool voiceTranscriptConsent;

  factory FarmerProfileData.fromJson(Json j) {
    final loc = j.obj('location');
    final consent = j.obj('consent') ?? const {};
    return FarmerProfileData(
      phoneMasked: j.strOrNull('phoneMasked') ?? '',
      preferredName: j.strOrNull('preferredName'),
      language: j.strOrNull('language') ?? 'en',
      state: j.strOrNull('state'),
      district: j.strOrNull('district'),
      village: j.strOrNull('village'),
      mainCrops: j.objects('mainCrops').map(CropRef.fromJson).toList(),
      voiceEnabled: j.boolean('voiceEnabled', true),
      onboarded: j.boolean('onboarded'),
      location: loc == null
          ? null
          : PlaceResult(label: loc.strOrNull('label') ?? '${loc.dbl('latitude').toStringAsFixed(2)}, ${loc.dbl('longitude').toStringAsFixed(2)}', latitude: loc.dbl('latitude'), longitude: loc.dbl('longitude')),
      photoConsent: consent.boolean('photos'),
      chatHistoryConsent: consent.boolean('chatHistory'),
      voiceTranscriptConsent: consent.boolean('voiceTranscripts'),
    );
  }
}

/// Farmer home, crop catalogue, history, profile and place search — all on the shared backend.
class FarmerRepository {
  FarmerRepository(this._api, this._prefs);
  final ApiClient _api;
  final PrefsStore _prefs;

  Future<Cached<T>> _withCache<T>(String key, Future<Json> Function() fetch, T Function(Json) parse) async {
    try {
      final json = await fetch();
      await _prefs.writeCache(key, json);
      return Cached(parse(json));
    } on ApiException catch (e) {
      if (!e.isTransient) rethrow;
      final cached = await _prefs.readCache(key);
      if (cached?.data is Map) return Cached(parse(asJson(cached!.data)), savedAt: cached.savedAt);
      rethrow;
    }
  }

  Future<Cached<HomeData>> home() => _withCache('home', () => _api.get('/api/v1/farmer/home', parse: asJson), HomeData.fromJson);

  Future<Cached<CropCatalogue>> crops() => _withCache('crops', () => _api.get('/api/v1/farmer/crops', parse: asJson), CropCatalogue.fromJson);

  Future<HistoryPage> history({String? cursor, int limit = 20}) => _api.get(
        '/api/v1/farmer/diagnoses',
        query: {'limit': limit, 'cursor': cursor},
        parse: (d) {
          final j = asJson(d);
          return HistoryPage(items: j.objects('items').map(CheckSummary.fromJson).toList(), total: j.integer('total'), nextCursor: j.strOrNull('nextCursor'));
        },
      );

  Future<FarmerProfileData> profile() => _api.get('/api/v1/farmer/profile', parse: (d) => FarmerProfileData.fromJson(asJson(d)));

  /// PATCH /api/v1/farmer/profile — only the keys given are changed. `complete: true` ends onboarding.
  Future<void> updateProfile(Json changes) => _api.patch('/api/v1/farmer/profile', body: changes, parse: (d) => d);

  Future<List<PlaceResult>> searchPlaces(String query) => _api.get(
        '/api/v1/geo/search',
        query: {'q': query},
        parse: (d) => asJson(d)
            .objects('results')
            .map((r) => PlaceResult(label: r.strOrNull('label') ?? r.str('name'), latitude: r.dbl('latitude'), longitude: r.dbl('longitude'), district: r.strOrNull('district'), state: r.strOrNull('state')))
            .toList(),
      );
}

final farmerRepositoryProvider = Provider<FarmerRepository>((ref) => FarmerRepository(ref.watch(apiClientProvider), ref.watch(prefsStoreProvider)));

final homeProvider = FutureProvider.autoDispose<Cached<HomeData>>((ref) => ref.watch(farmerRepositoryProvider).home());
final cropCatalogueProvider = FutureProvider<Cached<CropCatalogue>>((ref) => ref.watch(farmerRepositoryProvider).crops());
final profileProvider = FutureProvider.autoDispose<FarmerProfileData>((ref) => ref.watch(farmerRepositoryProvider).profile());
