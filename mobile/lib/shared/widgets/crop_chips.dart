import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../services/farmer_repository.dart';
import 'common.dart';

/// Multi-select of the model's real crop list (max [max]); search filters long lists.
class CropMultiSelect extends ConsumerStatefulWidget {
  const CropMultiSelect({super.key, required this.selected, required this.onChanged, this.max = 8});
  final List<String> selected;
  final ValueChanged<List<String>> onChanged;
  final int max;

  @override
  ConsumerState<CropMultiSelect> createState() => _CropMultiSelectState();
}

class _CropMultiSelectState extends ConsumerState<CropMultiSelect> {
  String _query = '';
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final catalogue = ref.watch(cropCatalogueProvider);
    return catalogue.when(
      loading: () => const Skeleton(height: 90),
      error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(cropCatalogueProvider)),
      data: (cached) {
        final crops = cached.value.crops.where((c) => c.matches(_query)).toList()
          ..sort((a, b) => (widget.selected.contains(b.id) ? 1 : 0) - (widget.selected.contains(a.id) ? 1 : 0));
        final visible = _expanded || _query.isNotEmpty ? crops : crops.take(14).toList();
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(prefixIcon: const Icon(Icons.search_rounded), hintText: MaterialLocalizations.of(context).searchFieldLabel),
          ),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final crop in visible)
              FilterChip(
                avatar: CropAvatar(imageUrl: crop.imageUrl, size: 26),
                label: Text(crop.name(lang)),
                selected: widget.selected.contains(crop.id),
                showCheckmark: false,
                selectedColor: CropColors.green800,
                labelStyle: TextStyle(color: widget.selected.contains(crop.id) ? Colors.white : CropColors.ink, fontWeight: FontWeight.w600),
                onSelected: (on) {
                  final next = [...widget.selected];
                  if (on && next.length < widget.max) next.add(crop.id);
                  if (!on) next.remove(crop.id);
                  widget.onChanged(next);
                },
              ),
          ]),
          if (!_expanded && _query.isEmpty && crops.length > visible.length)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(onPressed: () => setState(() => _expanded = true), icon: const Icon(Icons.expand_more_rounded), label: Text('+${crops.length - visible.length}')),
            ),
        ]);
      },
    );
  }
}
