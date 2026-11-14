import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/services/farmer_repository.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/location_picker.dart';
import '../application/scan_controller.dart';
import '../data/photo_service.dart';
import 'scan_screen.dart';

/// Step 3: check the photo, optionally add field details, then send it to the real model.
class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key});
  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  bool _showDetails = false;
  bool _consentAsked = false;
  String? _photoError;

  Future<void> _replace({required bool camera}) async {
    final l = AppLocalizations.of(context);
    try {
      final photo = await ref.read(photoServiceProvider).pick(camera: camera);
      if (photo != null) ref.read(scanControllerProvider.notifier).setPhoto(photo);
      if (mounted) setState(() => _photoError = null);
    } on PhotoException catch (e) {
      if (mounted) setState(() => _photoError = photoProblemText(e.problem, l));
    } catch (e) {
      if (mounted) setState(() => _photoError = errorMessage(e, l));
    }
  }

  Future<void> _submit(bool needsConsent) async {
    final scan = ref.read(scanControllerProvider);
    if (needsConsent && !scan.consent) {
      setState(() => _consentAsked = true);
      return;
    }
    final id = await ref.read(scanControllerProvider.notifier).submit();
    if (!mounted) return;
    final after = ref.read(scanControllerProvider);
    if (after.error is ApiException && (after.error! as ApiException).code == 'CONSENT_REQUIRED') {
      setState(() => _consentAsked = true);
      return;
    }
    if (id == null) return;
    ref.invalidate(homeProvider);
    ref.invalidate(profileProvider);
    // Capture the router first: go() disposes this screen, so its context is gone afterwards.
    final router = GoRouter.of(context);
    // Replace the scan flow with the report (back goes home, not to an old photo).
    router.go(Routes.home);
    ref.read(scanControllerProvider.notifier).reset();
    unawaited(router.push(Routes.diagnosis(id)));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final scan = ref.watch(scanControllerProvider);
    final photo = scan.photo;
    final profile = ref.watch(profileProvider).value;
    final needsConsent = _consentAsked || (profile != null && !profile.photoConsent);
    if (photo == null) {
      return Scaffold(appBar: AppBar(), body: EmptyState(icon: Icons.photo_outlined, title: l.scanTitle, action: FilledButton(onPressed: () => context.pop(), child: Text(l.back))));
    }

    return PopScope(
      canPop: !scan.busy,
      child: Scaffold(
        appBar: AppBar(title: Text(l.reviewTitle)),
        body: Stack(children: [
          ListView(padding: const EdgeInsets.fromLTRB(CropSpace.lg, 0, CropSpace.lg, 120), children: [
            FadeSlideIn(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(CropRadii.card),
                child: AspectRatio(
                  aspectRatio: (photo.width / photo.height).clamp(0.6, 1.6),
                  child: Hero(tag: 'scan-photo', child: Image.memory(photo.bytes, fit: BoxFit.cover)),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(l.photoDetails(photo.width, photo.height, Fmt.bytes(photo.bytes.length)), style: const TextStyle(color: CropColors.muted, fontSize: 12.5)),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: OutlinedButton.icon(onPressed: scan.busy ? null : () => _replace(camera: true), icon: const Icon(Icons.replay_rounded), label: Text(l.retake))),
              const SizedBox(width: 10),
              Expanded(child: OutlinedButton.icon(onPressed: scan.busy ? null : () => _replace(camera: false), icon: const Icon(Icons.photo_library_outlined), label: Text(l.replacePhoto))),
            ]),
            if (_photoError != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_photoError!, style: const TextStyle(color: CropColors.danger))),
            const SizedBox(height: 18),
            _FieldDetails(expanded: _showDetails, onToggle: () => setState(() => _showDetails = !_showDetails)),
            if (needsConsent) ...[
              const SizedBox(height: 14),
              AppCard(
                color: scan.consent ? CropColors.green100 : (_consentAsked ? CropColors.amber50 : null),
                padding: const EdgeInsets.all(14),
                child: CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: scan.consent,
                  onChanged: scan.busy ? null : (v) => ref.read(scanControllerProvider.notifier).setConsent(v ?? false),
                  title: Text(l.consentTitle, style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(_consentAsked && !scan.consent ? l.consentRequired : l.consentBody),
                ),
              ),
            ],
            if (scan.phase == UploadPhase.failed && scan.error != null) ...[
              const SizedBox(height: 14),
              AppCard(
                color: CropColors.amber50,
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(errorMessage(scan.error!, l), style: const TextStyle(color: CropColors.amber900, fontWeight: FontWeight.w700)),
                  if (scan.error is ApiException && (scan.error! as ApiException).kind == ApiErrorKind.timeout || scan.error is ApiException && (scan.error! as ApiException).kind == ApiErrorKind.offline)
                    Padding(padding: const EdgeInsets.only(top: 6), child: Text(l.uploadInterrupted, style: const TextStyle(color: CropColors.amber900))),
                ]),
              ),
            ],
          ]),
          Positioned(
            left: CropSpace.lg,
            right: CropSpace.lg,
            bottom: CropSpace.lg,
            child: SafeArea(top: false, child: _SubmitBar(onSubmit: () => _submit(needsConsent))),
          ),
        ]),
      ),
    );
  }
}

class _SubmitBar extends ConsumerWidget {
  const _SubmitBar({required this.onSubmit});
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final scan = ref.watch(scanControllerProvider);
    if (!scan.busy) {
      return FilledButton.icon(
        onPressed: onSubmit,
        icon: Icon(scan.phase == UploadPhase.failed ? Icons.refresh_rounded : Icons.biotech_rounded),
        label: Text(scan.phase == UploadPhase.failed ? l.retry : l.uploadButton),
      );
    }
    final analysing = scan.phase == UploadPhase.analysing;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: CropColors.green950, borderRadius: BorderRadius.circular(CropRadii.tile)),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: CropColors.green200, value: analysing ? null : scan.progress)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              analysing ? l.analysing : l.uploadingPercent((scan.progress * 100).round()),
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
            ),
          ),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: analysing ? null : scan.progress,
            minHeight: 8,
            backgroundColor: Colors.white.withValues(alpha: 0.15),
            color: CropColors.green500,
          ),
        ),
        if (analysing) ...[const SizedBox(height: 8), Text(l.analysingHint, style: const TextStyle(color: CropColors.green200, fontSize: 12.5))],
      ]),
    );
  }
}

/// Optional tap-to-choose questions served by the backend (same options as the web scan step).
class _FieldDetails extends ConsumerWidget {
  const _FieldDetails({required this.expanded, required this.onToggle});
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final lang = l.localeName;
    final scan = ref.watch(scanControllerProvider);
    final ctrl = ref.read(scanControllerProvider.notifier);
    final questions = ref.watch(cropCatalogueProvider).value?.value.questions ?? const [];
    final answered = scan.answers.length + (scan.parts.isEmpty ? 0 : 1) + (scan.note.trim().isEmpty ? 0 : 1);

    return AppCard(
      padding: const EdgeInsets.all(4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ListTile(
          onTap: onToggle,
          leading: const Icon(Icons.edit_note_rounded, color: CropColors.green600),
          title: Text(l.fieldDetailsTitle, style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text(answered > 0 ? '✓ $answered' : l.fieldDetailsHint),
          trailing: Icon(expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded),
        ),
        AnimatedCrossFade(
          duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 250),
          crossFadeState: expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
          firstChild: const SizedBox(width: double.infinity),
          secondChild: Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final q in questions) ...[
                const SizedBox(height: 10),
                Text(q.label(lang), style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final o in q.options)
                    ChoiceChip(
                      label: Text(o.label(lang)),
                      showCheckmark: false,
                      selected: q.multiple ? scan.parts.contains(o.id) : scan.answers[q.key] == o.id,
                      selectedColor: CropColors.green800,
                      labelStyle: TextStyle(
                        color: (q.multiple ? scan.parts.contains(o.id) : scan.answers[q.key] == o.id) ? Colors.white : CropColors.ink,
                        fontWeight: FontWeight.w600,
                      ),
                      onSelected: scan.busy ? null : (_) => q.multiple ? ctrl.togglePart(o.id) : ctrl.answer(q.key, o.id),
                    ),
                ]),
              ],
              const SizedBox(height: 14),
              TextField(
                maxLength: 240,
                minLines: 1,
                maxLines: 3,
                onChanged: ctrl.setNote,
                decoration: InputDecoration(hintText: l.fieldNoteHint),
              ),
              const SizedBox(height: 4),
              scan.location == null
                  ? OutlinedButton.icon(
                      onPressed: scan.busy
                          ? null
                          : () async {
                              final position = await currentApproximateLocation(context);
                              ctrl.setLocation(position);
                            },
                      icon: const Icon(Icons.my_location_rounded),
                      label: Text(l.addLocationToCheck),
                    )
                  : Row(children: [
                      const Icon(Icons.check_circle, color: CropColors.green600),
                      const SizedBox(width: 8),
                      Expanded(child: Text(l.locationAdded, style: const TextStyle(fontWeight: FontWeight.w700))),
                      IconButton(onPressed: () => ctrl.setLocation(null), icon: const Icon(Icons.close_rounded)),
                    ]),
            ]),
          ),
        ),
      ]),
    );
  }
}
