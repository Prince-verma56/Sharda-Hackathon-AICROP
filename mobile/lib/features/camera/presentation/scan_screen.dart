import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/permissions/permission_service.dart';
import '../../../core/providers.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/models/farmer_models.dart';
import '../../../shared/services/farmer_repository.dart';
import '../../../shared/widgets/common.dart';
import '../application/scan_controller.dart';
import '../data/photo_service.dart';

String photoProblemText(PhotoProblem p, AppLocalizations l) => switch (p) {
      PhotoProblem.tooLarge => l.photoTooLarge,
      PhotoProblem.tooSmall => l.photoTooSmall,
      PhotoProblem.unsupportedFormat => l.errImageFormat,
      PhotoProblem.unreadable => l.photoUnreadable,
    };

/// Step 2: capture a leaf photo (camera / gallery / licensed sample).
class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});
  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _pick({required bool camera}) async {
    final l = AppLocalizations.of(context);
    if (camera) {
      final outcome = await PermissionService.ensure(
        context,
        permission: Permission.camera,
        title: l.cameraPermissionTitle,
        body: l.cameraPermissionBody,
        icon: Icons.photo_camera_outlined,
      );
      if (outcome != PermissionOutcome.granted) return;
    }
    await _run(() => ref.read(photoServiceProvider).pick(camera: camera));
  }

  Future<void> _sample(SamplePhoto sample) => _run(() async {
        final bytes = await ref.read(apiClientProvider).getBytes(sample.url);
        return PhotoService.validate(bytes, filename: sample.file, source: 'sample');
      });

  Future<void> _run(Future<PickedPhoto?> Function() task) async {
    final l = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final photo = await task();
      if (photo == null || !mounted) return;
      ref.read(scanControllerProvider.notifier).setPhoto(photo);
      await context.push(Routes.scanReview);
    } on PhotoException catch (e) {
      if (mounted) setState(() => _error = photoProblemText(e.problem, l));
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e, l));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final scan = ref.watch(scanControllerProvider);
    final catalogue = ref.watch(cropCatalogueProvider).value?.value;
    final lang = l.localeName;
    final crop = scan.cropId == null || scan.cropId == 'auto' ? null : catalogue?.byId(scan.cropId!);
    final samples = (catalogue?.samples ?? const <SamplePhoto>[]).where((s) => scan.cropId == 'auto' || s.crop == scan.cropId).take(6).toList();

    return Scaffold(
      appBar: AppBar(title: Text(l.scanTitle)),
      body: ListView(padding: const EdgeInsets.fromLTRB(CropSpace.lg, 0, CropSpace.lg, CropSpace.xxl), children: [
        Row(children: [
          CropAvatar(imageUrl: crop?.imageUrl, size: 44),
          const SizedBox(width: 12),
          Expanded(child: Text(crop?.name(lang) ?? l.cropUnknown, style: Theme.of(context).textTheme.titleLarge)),
          TextButton(onPressed: () => context.pop(), child: Text(l.back)),
        ]),
        const SizedBox(height: 16),
        FadeSlideIn(
          child: AppCard(
            color: CropColors.green950,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.scanTipsTitle, style: const TextStyle(color: CropColors.green200, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              for (final (icon, tip) in [(Icons.center_focus_strong_rounded, l.scanTip1), (Icons.wb_sunny_outlined, l.scanTip2), (Icons.search_rounded, l.scanTip3)])
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                      child: Icon(icon, color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(tip, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
                  ]),
                ),
            ]),
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: PulseRing(
            active: !_busy,
            child: PressableScale(
              onTap: _busy ? null : () => _pick(camera: true),
              semanticLabel: l.takePhoto,
              child: Container(
                width: 132,
                height: 132,
                decoration: const BoxDecoration(color: CropColors.green800, shape: BoxShape.circle),
                child: _busy
                    ? const Center(child: CircularProgressIndicator(color: Colors.white))
                    : const Icon(Icons.photo_camera_rounded, size: 56, color: Colors.white),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(child: Text(l.takePhoto, style: Theme.of(context).textTheme.titleMedium)),
        const SizedBox(height: 20),
        OutlinedButton.icon(onPressed: _busy ? null : () => _pick(camera: false), icon: const Icon(Icons.photo_library_outlined), label: Text(l.chooseGallery)),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: CropColors.danger, fontWeight: FontWeight.w600)),
          ),
        if (samples.isNotEmpty) ...[
          const SizedBox(height: 28),
          SectionHeader(title: l.trySample, subtitle: l.sampleCredit),
          const SizedBox(height: 10),
          SizedBox(
            height: 112,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: samples.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, i) => PressableScale(
                onTap: _busy ? null : () => _sample(samples[i]),
                semanticLabel: samples[i].condition,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: SizedBox(width: 112, height: 112, child: PrivateImage(path: samples[i].url)),
                ),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}
