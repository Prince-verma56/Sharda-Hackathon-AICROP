import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/localization/generated/app_localizations.dart';
import '../../core/permissions/permission_service.dart';
import '../../core/theme/app_theme.dart';
import '../services/farmer_repository.dart';

/// Approximate device position (about 1 km — the server rounds it again) after explaining why.
/// Returns null when the farmer declines or the position cannot be read.
Future<({double latitude, double longitude, double accuracy})?> currentApproximateLocation(BuildContext context) async {
  final l = AppLocalizations.of(context);
  final outcome = await PermissionService.ensure(
    context,
    permission: Permission.locationWhenInUse,
    title: l.locationPermissionTitle,
    body: l.locationPermissionBody,
    icon: Icons.location_on_outlined,
  );
  if (outcome != PermissionOutcome.granted) return null;
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    final p = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.low, timeLimit: Duration(seconds: 20)),
    );
    return (latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy);
  } catch (_) {
    return null;
  }
}

/// Farm location: search a village/town (Open-Meteo geocoding via the backend) or use the phone's
/// approximate location. Only India is accepted (the backend validates the same bounds).
class LocationPicker extends ConsumerStatefulWidget {
  const LocationPicker({super.key, required this.value, required this.onChanged});
  final PlaceResult? value;
  final ValueChanged<PlaceResult?> onChanged;

  @override
  ConsumerState<LocationPicker> createState() => _LocationPickerState();
}

class _LocationPickerState extends ConsumerState<LocationPicker> {
  final _query = TextEditingController();
  Timer? _debounce;
  List<PlaceResult> _results = const [];
  bool _searching = false;
  bool _locating = false;
  String? _message;

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _onQuery(String text) {
    _debounce?.cancel();
    if (text.trim().length < 2) {
      setState(() => _results = const []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 450), () async {
      setState(() => _searching = true);
      try {
        final results = await ref.read(farmerRepositoryProvider).searchPlaces(text.trim());
        if (mounted) setState(() => _results = results);
      } catch (_) {
        if (mounted) setState(() => _results = const []);
      } finally {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  Future<void> _useDevice() async {
    final l = AppLocalizations.of(context);
    final hindi = Localizations.localeOf(context).languageCode == 'hi';
    setState(() {
      _locating = true;
      _message = null;
    });
    final position = await currentApproximateLocation(context);
    if (!mounted) return;
    setState(() => _locating = false);
    final inIndia = position != null && position.latitude >= 6 && position.latitude <= 38 && position.longitude >= 68 && position.longitude <= 98;
    if (!inIndia) {
      setState(() => _message = l.locationFailed);
      return;
    }
    widget.onChanged(PlaceResult(label: hindi ? 'फोन की लोकेशन' : 'Phone location', latitude: position.latitude, longitude: position.longitude));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final value = widget.value;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (value != null)
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: CropColors.green100, borderRadius: BorderRadius.circular(CropRadii.button)),
          child: Row(children: [
            const Icon(Icons.location_on, color: CropColors.green800),
            const SizedBox(width: 10),
            Expanded(child: Text(value.label, style: const TextStyle(fontWeight: FontWeight.w700))),
            IconButton(tooltip: l.removeLocation, onPressed: () => widget.onChanged(null), icon: const Icon(Icons.close_rounded)),
          ]),
        )
      else ...[
        TextField(
          controller: _query,
          onChanged: _onQuery,
          decoration: InputDecoration(
            hintText: l.searchPlaceHint,
            prefixIcon: const Icon(Icons.search_rounded),
            suffixIcon: _searching ? const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))) : null,
          ),
        ),
        for (final r in _results)
          ListTile(
            leading: const Icon(Icons.place_outlined),
            title: Text(r.label),
            onTap: () {
              _query.clear();
              setState(() => _results = const []);
              widget.onChanged(r);
            },
          ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _locating ? null : _useDevice,
          icon: _locating ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location_rounded),
          label: Text(l.useMyLocation),
        ),
        if (_message != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_message!, style: const TextStyle(color: CropColors.amber900))),
      ],
      const SizedBox(height: 6),
      Text(l.farmLocationHint, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: CropColors.muted)),
    ]);
  }
}
