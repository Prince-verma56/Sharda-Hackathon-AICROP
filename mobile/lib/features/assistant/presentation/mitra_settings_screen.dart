import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/common.dart';
import '../../authentication/application/auth_controller.dart';
import '../data/assistant_repository.dart';

final mitraSettingsProvider = FutureProvider.autoDispose<MitraSettings>((ref) => ref.watch(assistantRepositoryProvider).settings());

/// Language, tone, voice, pace and answer length — the same per-farmer settings as the web.
class MitraSettingsScreen extends ConsumerStatefulWidget {
  const MitraSettingsScreen({super.key});
  @override
  ConsumerState<MitraSettingsScreen> createState() => _MitraSettingsScreenState();
}

class _MitraSettingsScreenState extends ConsumerState<MitraSettingsScreen> {
  MitraSettings? _local;
  String? _saving;

  Future<void> _save(String key, String? value) async {
    final l = AppLocalizations.of(context);
    setState(() => _saving = key);
    try {
      final next = await ref.read(assistantRepositoryProvider).saveSetting(key, value);
      setState(() => _local = next);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.settingsSaved)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorMessage(e, l))));
    } finally {
      if (mounted) setState(() => _saving = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final lang = l.localeName;
    final name = ref.watch(assistantNameProvider);
    final settings = ref.watch(mitraSettingsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.mitraSettingsTitle(name))),
      body: settings.when(
        loading: () => const SkeletonList(count: 5, height: 120),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(mitraSettingsProvider)),
        data: (fetched) {
          final s = _local ?? fetched;
          return ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 32), children: [
            for (final g in s.groups) ...[
              const SizedBox(height: 16),
              AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    Expanded(child: Text(g.title[lang] ?? g.key, style: Theme.of(context).textTheme.titleMedium)),
                    if (_saving == g.key) const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                  ]),
                  const SizedBox(height: 4),
                  Text(g.help[lang] ?? '', style: const TextStyle(color: CropColors.muted, fontSize: 13)),
                  const SizedBox(height: 10),
                  for (final o in g.options)
                    RadioListTile<String>(
                      contentPadding: EdgeInsets.zero,
                      value: o.value,
                      // ignore: deprecated_member_use
                      groupValue: s.effective[g.key],
                      // ignore: deprecated_member_use
                      onChanged: _saving != null ? null : (v) => _save(g.key, v),
                      title: Text(o.label[lang] ?? o.value, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text([o.hint[lang], if (o.sample != null) '“${o.sample}”'].whereType<String>().where((t) => t.isNotEmpty).join('\n')),
                    ),
                  if (s.overrides[g.key] != null)
                    Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: _saving != null ? null : () => _save(g.key, null), child: Text(l.followDefault))),
                ]),
              ),
            ],
          ]);
        },
      ),
    );
  }
}
