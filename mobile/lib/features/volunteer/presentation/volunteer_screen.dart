import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/providers.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../core/utilities/json.dart';
import '../../../shared/widgets/common.dart';
import '../../authentication/application/auth_controller.dart';

/// Volunteer workspace — only reachable when the SERVER granted the volunteer workspace
/// (approved VOLUNTEER role, not suspended). Status + own educational videos; activities and
/// campaigns stay on the website (they have no API yet).
final myVideosProvider = FutureProvider.autoDispose<List<Json>>(
  (ref) => ref.read(apiClientProvider).get('/api/v1/volunteer/videos', parse: (d) => asJson(d).objects('videos')),
);

class VolunteerScreen extends ConsumerStatefulWidget {
  const VolunteerScreen({super.key});
  @override
  ConsumerState<VolunteerScreen> createState() => _VolunteerScreenState();
}

class _VolunteerScreenState extends ConsumerState<VolunteerScreen> {
  double? _progress;

  Future<void> _upload() async {
    final l = AppLocalizations.of(context);
    final file = await ImagePicker().pickVideo(source: ImageSource.gallery, maxDuration: const Duration(minutes: 10));
    if (file == null || !mounted) return;
    final title = await _askTitle();
    if (title == null) return;
    setState(() => _progress = 0);
    try {
      await ref.read(apiClientProvider).upload(
            '/api/v1/volunteer/videos',
            form: () => FormData.fromMap({
              'video': MultipartFile.fromFileSync(file.path, filename: file.name),
              'title': title,
              'language': l.localeName == 'hi' ? 'hi' : 'en',
            }),
            parse: (d) => d,
            sendTimeout: const Duration(minutes: 10),
            receiveTimeout: const Duration(minutes: 2),
            onSendProgress: (sent, total) => setState(() => _progress = total > 0 ? sent / total : null),
          );
      ref.invalidate(myVideosProvider);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.videoUploaded)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorMessage(e, l))));
    } finally {
      if (mounted) setState(() => _progress = null);
    }
  }

  Future<String?> _askTitle() {
    final l = AppLocalizations.of(context);
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(l.uploadVideo),
        content: TextField(controller: controller, autofocus: true, maxLength: 120, decoration: InputDecoration(labelText: l.videoTitleLabel)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d), child: Text(l.cancel)),
          FilledButton(
            onPressed: () {
              if (controller.text.trim().length >= 3) Navigator.pop(d, controller.text.trim());
            },
            child: Text(l.continueLabel),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final v = auth is AuthSignedIn ? auth.me.volunteer : null;
    final isFarmer = auth is AuthSignedIn && auth.me.isFarmer;
    final videos = ref.watch(myVideosProvider);
    String status(String s) => switch (s) {
          'VERIFIED' => l.statusVerified,
          'SUSPENDED' => l.statusSuspended,
          'IN_PROGRESS' => l.statusInProgress,
          'COMPLETED' => l.statusCompleted,
          'NOT_STARTED' => l.statusNotStarted,
          _ => l.statusPending,
        };

    return Scaffold(
      appBar: AppBar(
        title: Text(l.volunteerTitle),
        leading: isFarmer ? BackButton(onPressed: () => context.canPop() ? context.pop() : context.go(Routes.profile)) : null,
        actions: [if (!isFarmer) IconButton(tooltip: l.logout, onPressed: () => ref.read(authControllerProvider.notifier).logout(), icon: const Icon(Icons.logout_rounded))],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _progress != null ? null : _upload,
        icon: const Icon(Icons.video_call_outlined),
        label: Text(_progress == null ? l.uploadVideo : '${((_progress ?? 0) * 100).round()}%'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myVideosProvider.future),
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 96), children: [
          if (v != null)
            Row(children: [
              for (final (label, value, good) in [
                (l.verificationLabel, status(v.verificationStatus), v.verificationStatus == 'VERIFIED'),
                (l.trainingLabel, status(v.trainingStatus), v.trainingStatus == 'COMPLETED'),
                (l.profileCompleteLabel, v.profileComplete ? l.statusComplete : l.statusIncomplete, v.profileComplete),
              ])
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: AppCard(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(good ? Icons.check_circle_rounded : Icons.pending_outlined, color: good ? CropColors.green600 : CropColors.amber500),
                        const SizedBox(height: 6),
                        Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
                        Text(label, style: const TextStyle(fontSize: 12, color: CropColors.muted)),
                      ]),
                    ),
                  ),
                ),
            ]),
          const SizedBox(height: 20),
          SectionHeader(title: l.myVideos),
          const SizedBox(height: 10),
          if (_progress != null) LinearProgressIndicator(value: _progress),
          ...videos.when(
            loading: () => [const Skeleton(height: 80)],
            error: (e, _) => [ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(myVideosProvider))],
            data: (list) => list.isEmpty
                ? [Padding(padding: const EdgeInsets.all(16), child: Text(l.noVideos, style: const TextStyle(color: CropColors.muted)))]
                : [
                    for (final video in list)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: AppCard(
                          padding: const EdgeInsets.all(12),
                          child: Row(children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: SizedBox(
                                width: 80,
                                height: 56,
                                child: video.strOrNull('thumbnailUrl') == null
                                    ? Container(color: CropColors.green100, child: const Icon(Icons.movie_outlined, color: CropColors.green800))
                                    : PrivateImage(path: video.str('thumbnailUrl')),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(video.strOrNull('title') ?? '', style: const TextStyle(fontWeight: FontWeight.w800)),
                                Text(
                                  [Fmt.bytes(video.integer('bytes')), if (video.date('createdAt') != null) Fmt.date(video.date('createdAt')!, l.localeName)].join(' · '),
                                  style: const TextStyle(color: CropColors.muted, fontSize: 12),
                                ),
                                if (video.strOrNull('reviewNote') != null) Text(video.strOrNull('reviewNote')!, style: const TextStyle(fontSize: 12)),
                              ]),
                            ),
                            StatusPill(
                              label: switch (video.strOrNull('status')) { 'APPROVED' => l.videoApproved, 'REJECTED' => l.videoRejected, _ => l.videoPendingReview },
                              tone: switch (video.strOrNull('status')) { 'APPROVED' => PillTone.good, 'REJECTED' => PillTone.warn, _ => PillTone.info },
                            ),
                          ]),
                        ),
                      ),
                  ],
          ),
          const SizedBox(height: 16),
          AppCard(
            color: CropColors.sage,
            child: Text(l.volunteerWebNote),
          ),
        ]),
      ),
    );
  }
}
