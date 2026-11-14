import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/models/farmer_models.dart';
import '../../../shared/services/farmer_repository.dart';
import '../../../shared/widgets/common.dart';
import '../../camera/application/scan_controller.dart';

/// Step 1 of a crop check. The list is the loaded model's real crop list (never hard-coded).
class CropPickerScreen extends ConsumerStatefulWidget {
  const CropPickerScreen({super.key});
  @override
  ConsumerState<CropPickerScreen> createState() => _CropPickerScreenState();
}

class _CropPickerScreenState extends ConsumerState<CropPickerScreen> {
  String _query = '';

  void _choose(String cropId) {
    ref.read(scanControllerProvider.notifier).start(cropId);
    context.push(Routes.scan);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final catalogue = ref.watch(cropCatalogueProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.cropsTitle)),
      body: catalogue.when(
        loading: () => const SkeletonList(count: 6, height: 72),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(cropCatalogueProvider)),
        data: (cached) => _list(context, cached.value, l),
      ),
    );
  }

  Widget _list(BuildContext context, CropCatalogue c, AppLocalizations l) {
    final lang = l.localeName;
    final filtered = c.crops.where((crop) => crop.matches(_query)).toList();
    List<CropOption> pick(List<String> ids) => [for (final id in ids) ?c.byId(id)];
    final mine = pick(c.mine);
    final popular = pick(c.popular);
    final searching = _query.trim().isNotEmpty;

    return ListView(padding: const EdgeInsets.fromLTRB(CropSpace.lg, 0, CropSpace.lg, CropSpace.xxl), children: [
      Text(l.cropsSupported(c.crops.length), style: const TextStyle(color: CropColors.muted)),
      const SizedBox(height: 12),
      TextField(
        onChanged: (v) => setState(() => _query = v),
        decoration: InputDecoration(hintText: l.cropsSearchHint, prefixIcon: const Icon(Icons.search_rounded)),
      ),
      const SizedBox(height: 16),
      if (c.autoCrop && !searching)
        FadeSlideIn(
          child: AppCard(
            color: CropColors.sage,
            onTap: () => _choose('auto'),
            child: Row(children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: const Icon(Icons.help_outline_rounded, color: CropColors.green800, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l.cropUnknown, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(l.cropUnknownHint, style: const TextStyle(color: CropColors.green900, fontSize: 13)),
                ]),
              ),
            ]),
          ),
        ),
      if (!searching && mine.isNotEmpty) ...[
        const SizedBox(height: 20),
        SectionHeader(title: l.cropsMine),
        const SizedBox(height: 10),
        _Grid(crops: mine, lang: lang, onTap: _choose),
      ],
      if (!searching && popular.isNotEmpty) ...[
        const SizedBox(height: 20),
        SectionHeader(title: l.cropsPopular),
        const SizedBox(height: 10),
        _Grid(crops: popular, lang: lang, onTap: _choose),
      ],
      const SizedBox(height: 20),
      SectionHeader(title: l.cropsAll),
      const SizedBox(height: 10),
      if (filtered.isEmpty) Padding(padding: const EdgeInsets.all(20), child: Text(l.cropsNoMatch, textAlign: TextAlign.center)) else _Grid(crops: filtered, lang: lang, onTap: _choose),
    ]);
  }
}

class _Grid extends StatelessWidget {
  const _Grid({required this.crops, required this.lang, required this.onTap});
  final List<CropOption> crops;
  final String lang;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final columns = constraints.maxWidth > 560 ? 5 : 3;
      final width = (constraints.maxWidth - (columns - 1) * 10) / columns;
      return Wrap(spacing: 10, runSpacing: 10, children: [
        for (final crop in crops)
          SizedBox(
            width: width,
            child: PressableScale(
              onTap: () => onTap(crop.id),
              semanticLabel: crop.name(lang),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(CropRadii.tile), border: Border.all(color: CropColors.border)),
                child: Column(children: [
                  AspectRatio(aspectRatio: 1, child: CropAvatar(imageUrl: crop.imageUrl, size: width, radius: 14)),
                  const SizedBox(height: 6),
                  Text(crop.name(lang), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                ]),
              ),
            ),
          ),
      ]);
    });
  }
}
