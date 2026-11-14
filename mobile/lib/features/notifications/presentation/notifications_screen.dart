import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/providers.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../core/utilities/json.dart';
import '../../../shared/services/farmer_repository.dart';
import '../../../shared/widgets/common.dart';

/// In-app notifications (existing /api/v1/notifications endpoints, Bearer-authenticated).
final notificationsProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  final api = ref.read(apiClientProvider);
  return api.get('/api/v1/notifications', query: {'page': 1, 'pageSize': 30}, parse: (d) => asJson(d).objects('items'));
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  Future<void> _markAll(WidgetRef ref) async {
    await ref.read(apiClientProvider).post('/api/v1/notifications/read-all', parse: (d) => d);
    ref.invalidate(notificationsProvider);
    ref.invalidate(homeProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final items = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(l.notificationsTitle),
        actions: [TextButton(onPressed: () => _markAll(ref).catchError((_) {}), child: Text(l.markAllRead))],
      ),
      body: items.when(
        loading: () => const SkeletonList(count: 5, height: 80),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(notificationsProvider)),
        data: (list) => list.isEmpty
            ? EmptyState(icon: Icons.notifications_none_rounded, title: l.notificationsEmpty)
            : RefreshIndicator(
                onRefresh: () => ref.refresh(notificationsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final n = list[i];
                    final unread = n['readAt'] == null;
                    final diagnosisId = n.obj('metadata')?.strOrNull('diagnosisId');
                    final created = n.date('createdAt');
                    return AppCard(
                      color: unread ? CropColors.green100 : null,
                      padding: const EdgeInsets.all(14),
                      onTap: () async {
                        if (unread) {
                          await ref.read(apiClientProvider).post('/api/v1/notifications/${n.str('id')}/read', parse: (d) => d).catchError((_) => null);
                          ref.invalidate(notificationsProvider);
                        }
                        if (diagnosisId != null && context.mounted) await context.push(Routes.diagnosis(diagnosisId));
                      },
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(unread ? Icons.notifications_active_rounded : Icons.notifications_none_rounded, color: CropColors.green800),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(n.strOrNull('title') ?? '', style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(n.strOrNull('message') ?? ''),
                            if (created != null) Text(Fmt.dateTime(created, l.localeName), style: const TextStyle(color: CropColors.muted, fontSize: 12)),
                          ]),
                        ),
                      ]),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
