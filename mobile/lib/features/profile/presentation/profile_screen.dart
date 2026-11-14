import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/providers.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/services/farmer_repository.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/crop_chips.dart';
import '../../../shared/widgets/links.dart';
import '../../../shared/widgets/location_picker.dart';
import '../../assistant/data/assistant_repository.dart';
import '../../authentication/application/auth_controller.dart';
import '../../government_resources/presentation/resources_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final profile = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.profileTitle)),
      body: profile.when(
        loading: () => const SkeletonList(count: 4, height: 140),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(profileProvider)),
        data: (p) => _ProfileForm(key: ValueKey(p.hashCode), profile: p),
      ),
    );
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({super.key, required this.profile});
  final FarmerProfileData profile;
  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  late final _name = TextEditingController(text: widget.profile.preferredName ?? '');
  late final _village = TextEditingController(text: widget.profile.village ?? '');
  late final _district = TextEditingController(text: widget.profile.district ?? '');
  late final _state = TextEditingController(text: widget.profile.state ?? '');
  late List<String> _crops = widget.profile.mainCrops.map((c) => c.id).toList();
  late PlaceResult? _location = widget.profile.location;
  late bool _voice = widget.profile.voiceEnabled;
  late bool _chatConsent = widget.profile.chatHistoryConsent;
  late bool _voiceConsent = widget.profile.voiceTranscriptConsent;
  bool _saving = false;

  @override
  void dispose() {
    for (final c in [_name, _village, _district, _state]) {
      c.dispose();
    }
    super.dispose();
  }

  void _toast(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    String? t(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();
    setState(() => _saving = true);
    try {
      await ref.read(farmerRepositoryProvider).updateProfile({
        'preferredName': t(_name),
        'village': t(_village),
        'district': t(_district),
        'state': t(_state),
        'mainCrops': _crops,
        'voiceEnabled': _voice,
        'location': _location == null ? null : {'latitude': _location!.latitude, 'longitude': _location!.longitude, 'label': _location!.label},
      });
      await ref.read(authControllerProvider.notifier).refreshMe();
      ref.invalidate(homeProvider);
      _toast(l.profileSaved);
    } catch (e) {
      _toast(errorMessage(e, l));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _consent({bool? chat, bool? voice}) async {
    final l = AppLocalizations.of(context);
    try {
      final r = await ref.read(assistantRepositoryProvider).setConsent(chatHistory: chat, voiceTranscripts: voice);
      setState(() {
        _chatConsent = r.chatHistory;
        _voiceConsent = r.voiceTranscripts;
      });
    } catch (e) {
      _toast(errorMessage(e, l));
    }
  }

  Future<void> _logout({required bool everywhere}) async {
    final l = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        content: Text(everywhere ? l.logoutEverywhereConfirm : l.logoutConfirm),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(everywhere ? l.logoutEverywhere : l.logout)),
        ],
      ),
    );
    if (ok != true) return;
    ref.invalidate(privateImageProvider);
    await ref.read(authControllerProvider.notifier).logout(everywhere: everywhere);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final p = widget.profile;
    final lang = ref.watch(localeProvider).languageCode;
    final config = ref.watch(mobileConfigProvider).value;
    final appConfig = ref.watch(appConfigProvider);
    final auth = ref.watch(authControllerProvider);
    final volunteer = auth is AuthSignedIn && auth.me.hasVolunteerWorkspace;
    Widget label(String text) => Padding(padding: const EdgeInsets.only(top: 18, bottom: 8), child: Text(text, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)));

    return ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 40), children: [
      AppCard(
        child: Row(children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(color: CropColors.green100, borderRadius: BorderRadius.circular(16)),
            child: const Icon(Icons.phone_iphone_rounded, color: CropColors.green800),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.phoneMasked, style: theme.textTheme.titleMedium),
              Text(l.phoneVerified, style: const TextStyle(color: CropColors.muted, fontSize: 13)),
            ]),
          ),
        ]),
      ),
      const SizedBox(height: 16),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(l.languageLabel, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            showSelectedIcon: false,
            segments: [ButtonSegment(value: 'en', label: Text(l.languageEnglish)), ButtonSegment(value: 'hi', label: Text(l.languageHindi))],
            selected: {lang},
            onSelectionChanged: (s) async {
              await ref.read(localeProvider.notifier).setLanguage(s.first);
              ref.invalidate(homeProvider);
              ref.invalidate(cropCatalogueProvider);
            },
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
          SwitchListTile(contentPadding: EdgeInsets.zero, value: _voice, onChanged: (v) => setState(() => _voice = v), title: Text(l.voiceEnabledLabel)),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text(l.save),
          ),
        ]),
      ),
      const SizedBox(height: 16),
      AppCard(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(children: [
          ListTile(
            leading: const Icon(Icons.tune_rounded, color: CropColors.green800),
            title: Text(l.mitraSettingsTitle(ref.watch(assistantNameProvider))),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push(Routes.settings),
          ),
          ListTile(
            leading: const Icon(Icons.account_balance_outlined, color: CropColors.green800),
            title: Text(l.resourcesTitle),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push(Routes.resources),
          ),
          if (volunteer)
            ListTile(
              leading: const Icon(Icons.volunteer_activism_outlined, color: CropColors.green800),
              title: Text(l.volunteerWorkspace),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => context.push(Routes.volunteer),
            ),
        ]),
      ),
      const SizedBox(height: 16),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(l.consentsTitle, style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(p.photoConsent ? Icons.check_circle_rounded : Icons.radio_button_unchecked, color: CropColors.green600),
            title: Text(p.photoConsent ? l.photoConsentOn : l.photoConsentOff),
            subtitle: p.photoConsent ? Text(l.photoConsentWithdrawNote) : null,
          ),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: _chatConsent, onChanged: (v) => _consent(chat: v), title: Text(l.saveTextChats)),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _voiceConsent,
            onChanged: (v) => _consent(voice: v),
            title: Text(l.saveVoiceTranscripts),
            subtitle: Text(l.audioNeverRecorded),
          ),
        ]),
      ),
      const SizedBox(height: 16),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(l.requestDataTitle, style: theme.textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(config?.supportEmail == null ? l.requestDataNoEmail : l.requestDataHow(config!.supportEmail!), style: const TextStyle(color: CropColors.muted)),
          if (config?.supportEmail != null)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => openExternal(Uri(scheme: 'mailto', path: config!.supportEmail, query: 'subject=CropAI data request')),
                icon: const Icon(Icons.mail_outline_rounded),
                label: Text(l.emailSupport),
              ),
            ),
          Wrap(spacing: 4, children: [
            TextButton(onPressed: () => context.push(Routes.resources, extra: ResourcesTab.dataRights), child: Text(l.dataRightsTitle)),
            WebLinkButton(label: l.privacyPolicy, path: config?.links['privacyPolicy'] ?? '/privacy-policy'),
            WebLinkButton(label: l.terms, path: config?.links['terms'] ?? '/terms-and-conditions'),
          ]),
        ]),
      ),
      const SizedBox(height: 16),
      OutlinedButton.icon(onPressed: () => _logout(everywhere: false), icon: const Icon(Icons.logout_rounded), label: Text(l.logout)),
      const SizedBox(height: 8),
      TextButton(onPressed: () => _logout(everywhere: true), child: Text(l.logoutEverywhere)),
      const SizedBox(height: 16),
      Text(
        '${l.appVersion(ref.watch(appVersionProvider), appConfig.environment.name)}\n${l.serverLabel(appConfig.apiBaseUrl.toString())}',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 12, color: CropColors.muted),
      ),
    ]);
  }
}
