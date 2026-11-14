import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/services/farmer_repository.dart';
import '../../../shared/widgets/crop_chips.dart';
import '../../../shared/widgets/location_picker.dart';
import '../../authentication/application/auth_controller.dart';

/// Optional first-run profile. Nothing is required; "Skip" goes straight to crop checks.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _name = TextEditingController();
  final _state = TextEditingController();
  final _district = TextEditingController();
  final _village = TextEditingController();
  List<String> _crops = [];
  PlaceResult? _location;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final auth = ref.read(authControllerProvider);
    if (auth is AuthSignedIn) _name.text = auth.me.farmer?.preferredName ?? '';
  }

  @override
  void dispose() {
    for (final c in [_name, _state, _district, _village]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _text(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _finish({required bool skip}) async {
    final l = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(farmerRepositoryProvider).updateProfile({
        if (!skip) ...{
          'preferredName': _text(_name),
          'language': ref.read(localeProvider).languageCode,
          'state': _text(_state),
          'district': _text(_district),
          'village': _text(_village),
          'mainCrops': _crops,
          if (_location != null) 'location': {'latitude': _location!.latitude, 'longitude': _location!.longitude, 'label': _location!.label},
        },
        'complete': true,
      });
      await ref.read(authControllerProvider.notifier).refreshMe();
    } catch (e) {
      if (skip) {
        // Offline: remember the skip locally so the farmer can start right away.
        await ref.read(authControllerProvider.notifier).skipOnboarding();
      } else if (mounted) {
        setState(() => _error = errorMessage(e, l));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final lang = ref.watch(localeProvider).languageCode;
    Widget label(String text) => Padding(padding: const EdgeInsets.only(top: 22, bottom: 8), child: Text(text, style: theme.textTheme.titleMedium));

    return Scaffold(
      appBar: AppBar(actions: [TextButton(onPressed: _busy ? null : () => _finish(skip: true), child: Text(l.skipForNow))]),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(24, 0, 24, 24), children: [
          FadeSlideIn(child: Text(l.onboardingTitle, style: theme.textTheme.headlineMedium)),
          const SizedBox(height: 8),
          Text(l.onboardingSubtitle, style: theme.textTheme.bodyLarge?.copyWith(color: CropColors.muted)),
          label(l.languageLabel),
          SegmentedButton<String>(
            showSelectedIcon: false,
            segments: [ButtonSegment(value: 'en', label: Text(l.languageEnglish)), ButtonSegment(value: 'hi', label: Text(l.languageHindi))],
            selected: {lang},
            onSelectionChanged: (s) => ref.read(localeProvider.notifier).setLanguage(s.first),
          ),
          label(l.preferredNameLabel),
          TextField(controller: _name, textCapitalization: TextCapitalization.words, maxLength: 60, decoration: const InputDecoration(counterText: '')),
          label(l.mainCropsLabel),
          CropMultiSelect(selected: _crops, onChanged: (v) => setState(() => _crops = v)),
          label(l.farmLocationLabel),
          LocationPicker(value: _location, onChanged: (v) => setState(() => _location = v)),
          label(l.villageLabel),
          TextField(controller: _village, maxLength: 80, decoration: const InputDecoration(counterText: '')),
          label(l.districtLabel),
          TextField(controller: _district, maxLength: 60, decoration: const InputDecoration(counterText: '')),
          label(l.stateLabel),
          TextField(controller: _state, maxLength: 60, decoration: const InputDecoration(counterText: '')),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: CropColors.danger))),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy ? null : () => _finish(skip: false),
            child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text(l.onboardingFinish),
          ),
        ]),
      ),
    );
  }
}
