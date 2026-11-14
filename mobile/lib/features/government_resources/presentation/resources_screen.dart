import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../core/utilities/json.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/links.dart';

enum ResourcesTab { government, dataRights }

class ResourcesData {
  const ResourcesData(this.json, {this.savedAt});
  final Json json;
  final DateTime? savedAt;
}

/// GET /api/v1/resources — verified official links (same content as the web /resources page).
/// Public and cached on the device, so it stays readable offline.
final resourcesProvider = FutureProvider.autoDispose<ResourcesData>((ref) async {
  const key = 'public.resources';
  final prefs = ref.read(prefsStoreProvider);
  try {
    final json = await ref.read(apiClientProvider).get('/api/v1/resources', auth: false, parse: asJson);
    await prefs.writeCache(key, json);
    return ResourcesData(json);
  } on ApiException catch (e) {
    final cached = await prefs.readCache(key);
    if (cached?.data is Map && e.isTransient) return ResourcesData(asJson(cached!.data), savedAt: cached.savedAt);
    rethrow;
  }
});

const _icons = <String, IconData>{
  'income': Icons.currency_rupee_rounded,
  'insurance': Icons.umbrella_outlined,
  'soil': Icons.science_outlined,
  'protection': Icons.bug_report_outlined,
  'market': Icons.storefront_outlined,
  'prices': Icons.trending_up_rounded,
  'weather': Icons.cloud_outlined,
  'sms': Icons.sms_outlined,
  'helpline': Icons.call_outlined,
  'kvk': Icons.biotech_outlined,
  'ministry': Icons.account_balance_outlined,
};

class ResourcesScreen extends ConsumerWidget {
  const ResourcesScreen({super.key, this.initialTab = ResourcesTab.government});
  final ResourcesTab initialTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final data = ref.watch(resourcesProvider);
    return DefaultTabController(
      length: 2,
      initialIndex: initialTab.index,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.resourcesTitle),
          bottom: TabBar(tabs: [Tab(text: l.resourcesTitle), Tab(text: l.dataRightsTitle)]),
        ),
        body: data.when(
          loading: () => const SkeletonList(count: 5, height: 130),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(resourcesProvider)),
          data: (d) => TabBarView(children: [_Government(data: d), _DataRights(data: d)]),
        ),
      ),
    );
  }
}

class _Government extends StatelessWidget {
  const _Government({required this.data});
  final ResourcesData data;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final lang = l.localeName;
    final checked = data.json.date('lastChecked');
    return ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 32), children: [
      if (data.savedAt != null) OfflineBanner(savedAt: Fmt.dateTime(data.savedAt!, lang)),
      Text(l.resourcesSubtitle, style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 4),
      Text(l.resourcesNote, style: const TextStyle(color: CropColors.muted)),
      if (checked != null) Text(l.lastChecked(Fmt.date(checked, lang)), style: const TextStyle(color: CropColors.muted, fontSize: 12)),
      for (final group in data.json.objects('groups')) ...[
        const SizedBox(height: 22),
        SectionHeader(title: group.obj('title')?.strOrNull(lang) ?? group.obj('title')?.strOrNull('en') ?? ''),
        const SizedBox(height: 10),
        for (final (i, r) in group.objects('resources').indexed)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: FadeSlideIn(delay: Duration(milliseconds: 40 * i), child: _ResourceCard(r: r, lang: lang)),
          ),
      ],
    ]);
  }
}

class _ResourceCard extends StatelessWidget {
  const _ResourceCard({required this.r, required this.lang});
  final Json r;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final name = r.obj('name') ?? const {};
    final url = r.strOrNull('url');
    final phone = r.obj('phone');
    final primary = lang == 'hi' ? name.strOrNull('hi') : name.strOrNull('en');
    final secondary = lang == 'hi' ? name.strOrNull('en') : name.strOrNull('hi');
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: CropColors.green100, borderRadius: BorderRadius.circular(16)),
            child: Icon(_icons[r.strOrNull('icon')] ?? Icons.link_rounded, color: CropColors.green800),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(primary ?? '', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              if (secondary != null) Text(secondary, style: const TextStyle(color: CropColors.muted, fontSize: 13)),
            ]),
          ),
          StatusPill(label: url == null ? l.linkUnavailable : l.officialSite, tone: url == null ? PillTone.neutral : PillTone.good),
        ]),
        const SizedBox(height: 10),
        Text(r.strOrNull('description') ?? '', style: const TextStyle(height: 1.45)),
        if (r.strOrNull('linkNote') != null) ...[const SizedBox(height: 6), Text(r.strOrNull('linkNote')!, style: const TextStyle(color: CropColors.muted, fontSize: 12.5))],
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (url != null)
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 46)),
              onPressed: () => openExternal(Uri.parse(url)),
              icon: const Icon(Icons.open_in_new_rounded, size: 18),
              label: Text(Uri.parse(url).host.replaceFirst('www.', '')),
            ),
          if (phone != null)
            FilledButton.icon(
              style: FilledButton.styleFrom(minimumSize: const Size(0, 46)),
              onPressed: () => openExternal(Uri.parse('tel:${phone.strOrNull('tel') ?? ''}')),
              icon: const Icon(Icons.call_rounded, size: 18),
              label: Text('${phone.strOrNull('label') ?? l.call}: ${phone.strOrNull('display') ?? ''}'),
            ),
        ]),
      ]),
    );
  }
}

class _DataRights extends StatelessWidget {
  const _DataRights({required this.data});
  final ResourcesData data;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final lang = l.localeName;
    final email = data.json.strOrNull('contactEmail');
    return ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 32), children: [
      for (final right in data.json.objects('dataRights'))
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AppCard(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(lang == 'hi' ? (right.strOrNull('hindi') ?? right.strOrNull('title') ?? '') : (right.strOrNull('title') ?? ''), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 6),
              Text(right.strOrNull('summary') ?? ''),
              if (right.strOrNull('byRequest') != null) ...[
                const SizedBox(height: 8),
                Text(l.byRequestLabel, style: const TextStyle(fontWeight: FontWeight.w800, color: CropColors.green800, fontSize: 12.5)),
                Text(right.strOrNull('byRequest')!, style: const TextStyle(color: CropColors.muted)),
              ],
            ]),
          ),
        ),
      Text(email == null ? l.requestDataNoEmail : l.requestDataHow(email), style: const TextStyle(color: CropColors.muted)),
    ]);
  }
}
