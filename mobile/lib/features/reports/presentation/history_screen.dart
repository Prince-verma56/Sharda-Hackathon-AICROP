import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/models/farmer_models.dart';
import '../../../shared/services/farmer_repository.dart';
import '../../../shared/widgets/common.dart';

class HistoryState {
  const HistoryState({this.items = const [], this.total = 0, this.nextCursor, this.loadingMore = false, this.error});
  final List<CheckSummary> items;
  final int total;
  final String? nextCursor;
  final bool loadingMore;
  final Object? error;
}

/// Cursor-paginated diagnosis history (GET /api/v1/farmer/diagnoses).
class HistoryController extends AsyncNotifier<HistoryState> {
  @override
  Future<HistoryState> build() async {
    final page = await ref.read(farmerRepositoryProvider).history();
    return HistoryState(items: page.items, total: page.total, nextCursor: page.nextCursor);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.nextCursor == null || current.loadingMore) return;
    state = AsyncData(HistoryState(items: current.items, total: current.total, nextCursor: current.nextCursor, loadingMore: true));
    try {
      final page = await ref.read(farmerRepositoryProvider).history(cursor: current.nextCursor);
      state = AsyncData(HistoryState(items: [...current.items, ...page.items], total: page.total, nextCursor: page.nextCursor));
    } catch (e) {
      state = AsyncData(HistoryState(items: current.items, total: current.total, nextCursor: current.nextCursor, error: e));
    }
  }
}

final historyProvider = AsyncNotifierProvider.autoDispose<HistoryController, HistoryState>(HistoryController.new);

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final history = ref.watch(historyProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(l.historyTitle),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilledButton.icon(
              style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
              onPressed: () => context.push(Routes.crops),
              icon: const Icon(Icons.photo_camera_outlined, size: 20),
              label: Text(l.newCheck),
            ),
          ),
        ],
      ),
      body: history.when(
        loading: () => const SkeletonList(count: 6),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(historyProvider)),
        data: (state) {
          if (state.items.isEmpty) {
            return EmptyState(
              icon: Icons.description_outlined,
              title: l.historyEmpty,
              hint: l.historyEmptyHint,
              action: FilledButton.icon(onPressed: () => context.push(Routes.crops), icon: const Icon(Icons.photo_camera_outlined), label: Text(l.actionCheckCrop)),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(historyProvider.future),
            child: NotificationListener<ScrollNotification>(
              onNotification: (n) {
                if (n.metrics.pixels > n.metrics.maxScrollExtent - 400) ref.read(historyProvider.notifier).loadMore();
                return false;
              },
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(CropSpace.lg, 4, CropSpace.lg, CropSpace.xxl),
                itemCount: state.items.length + 2,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  if (i == 0) {
                    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      const OfflineBanner(),
                      Text(l.checksCount(state.total), style: const TextStyle(color: CropColors.muted, fontWeight: FontWeight.w600)),
                    ]);
                  }
                  if (i == state.items.length + 1) {
                    if (state.loadingMore) return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
                    if (state.error != null) return ErrorView(error: state.error!, compact: true, onRetry: () => ref.read(historyProvider.notifier).loadMore());
                    if (state.nextCursor != null) return TextButton(onPressed: () => ref.read(historyProvider.notifier).loadMore(), child: Text(l.loadMore));
                    return const SizedBox(height: 8);
                  }
                  final item = state.items[i - 1];
                  return FadeSlideIn(delay: Duration(milliseconds: 30 * ((i - 1) % 8)), child: _HistoryCard(item: item));
                },
              ),
            ),
          );
        },
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.item});
  final CheckSummary item;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final review = switch (item.reviewStatus) {
      'PENDING' => l.reviewPending,
      'CONFIRMED' => l.reviewConfirmed,
      'CHALLENGED' => l.reviewChallenged,
      'NEEDS_INFO' => l.reviewNeedsInfo,
      _ => null,
    };
    return AppCard(
      padding: const EdgeInsets.all(12),
      onTap: () => context.push('/farmer/history/${item.id}'),
      child: Row(children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: SizedBox(
            width: 84,
            height: 84,
            child: item.thumbnailUrl == null ? CropAvatar(imageUrl: item.crop.imageUrl, size: 84, radius: 18) : PrivateImage(path: item.thumbnailUrl!),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.crop.name, style: const TextStyle(color: CropColors.muted, fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 2),
            Text(item.condition, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('${Fmt.dateTime(item.createdAt, l.localeName)} · ${Fmt.percent(item.score)}', style: const TextStyle(color: CropColors.muted, fontSize: 12.5)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              StatusPill(label: item.isHealthy ? l.looksHealthy : l.needsAttention, tone: item.isHealthy ? PillTone.good : PillTone.warn),
              if (review != null) StatusPill(label: review, tone: PillTone.info, icon: Icons.verified_outlined),
            ]),
          ]),
        ),
      ]),
    );
  }
}
