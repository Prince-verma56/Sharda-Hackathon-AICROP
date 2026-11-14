import 'dart:async';
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/links.dart';
import '../../authentication/application/auth_controller.dart';
import '../../weather/presentation/weather_widgets.dart';
import '../data/diagnosis_repository.dart';
import '../data/report_models.dart';
import 'report_widgets.dart';

final reportProvider = FutureProvider.autoDispose.family<LoadedReport, ({String id, String lang})>(
  (ref, key) => ref.watch(diagnosisRepositoryProvider).report(key.id, key.lang),
);

class ReportScreen extends ConsumerWidget {
  const ReportScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = Localizations.localeOf(context).languageCode;
    final key = (id: id, lang: lang);
    final report = ref.watch(reportProvider(key));
    final l = AppLocalizations.of(context);
    return report.when(
      loading: () => Scaffold(
        appBar: AppBar(title: Text(l.reportTitle)),
        body: ListView(padding: const EdgeInsets.all(16), children: const [Skeleton(height: 300), SizedBox(height: 12), Skeleton(height: 220), SizedBox(height: 12), Skeleton(height: 160)]),
      ),
      error: (e, _) => Scaffold(appBar: AppBar(title: Text(l.reportTitle)), body: ErrorView(error: e, onRetry: () => ref.invalidate(reportProvider(key)))),
      data: (loaded) => _ReportView(loaded: loaded, onRefresh: () => ref.refresh(reportProvider(key).future)),
    );
  }
}

class _ReportView extends ConsumerStatefulWidget {
  const _ReportView({required this.loaded, required this.onRefresh});
  final LoadedReport loaded;
  final Future<LoadedReport> Function() onRefresh;
  @override
  ConsumerState<_ReportView> createState() => _ReportViewState();
}

class _ReportViewState extends ConsumerState<_ReportView> {
  final _summaryKey = GlobalKey();
  final _tts = FlutterTts();
  bool _speaking = false;
  bool? _helpful;
  String? _reviewStatus;

  FarmerReport get r => widget.loaded.report;

  @override
  void initState() {
    super.initState();
    _helpful = r.feedbackHelpful;
    _tts.setCompletionHandler(() {
      if (mounted) setState(() => _speaking = false);
    });
    _tts.setCancelHandler(() {
      if (mounted) setState(() => _speaking = false);
    });
  }

  @override
  void dispose() {
    // The TTS engine may be missing (or not installed for Hindi): never crash on leave.
    unawaited(_tts.stop().then<void>((_) {}, onError: (Object _) {}));
    super.dispose();
  }

  void _snack(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _listen() async {
    final l = AppLocalizations.of(context);
    if (_speaking) {
      await _tts.stop();
      setState(() => _speaking = false);
      return;
    }
    try {
      final available = await _tts.isLanguageAvailable(r.speechLocale);
      await _tts.setLanguage(available == true ? r.speechLocale : 'en-IN');
      await _tts.setSpeechRate(0.45);
      setState(() => _speaking = true);
      await _tts.speak(r.speechText.isEmpty ? r.shareText : r.speechText);
    } catch (_) {
      setState(() => _speaking = false);
      _snack(l.ttsUnavailable);
    }
  }

  Future<void> _share() => SharePlus.instance.share(ShareParams(text: r.shareText, subject: AppLocalizations.of(context).reportTitle));

  /// Renders the summary card to a PNG (Flutter's text engine, so Hindi renders correctly) and
  /// opens the system sheet to save or send it.
  Future<void> _saveImage() async {
    final l = AppLocalizations.of(context);
    try {
      final boundary = _summaryKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2.5);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) throw StateError('no bytes');
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(bytes.buffer.asUint8List(), mimeType: 'image/png', name: 'cropai-report-${r.id}.png')],
        fileNameOverrides: ['cropai-report-${r.id}.png'],
        text: r.shareText,
      ));
    } catch (e) {
      _snack(errorMessage(e, l));
    }
  }

  Future<void> _feedback(bool helpful) async {
    final l = AppLocalizations.of(context);
    setState(() => _helpful = helpful);
    try {
      await ref.read(diagnosisRepositoryProvider).feedback(r.id, helpful: helpful);
      _snack(l.feedbackThanks);
    } catch (e) {
      _snack(errorMessage(e, l));
    }
  }

  Future<void> _requestExpert() async {
    final l = AppLocalizations.of(context);
    try {
      final status = await ref.read(diagnosisRepositoryProvider).requestExpert(r.id);
      setState(() => _reviewStatus = status);
      _snack(l.expertRequested);
    } catch (e) {
      _snack(errorMessage(e, l));
    }
  }

  void _support() {
    final l = AppLocalizations.of(context);
    final email = ref.read(mobileConfigProvider).value?.supportEmail;
    final status = _reviewStatus ?? r.review.status;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.call_rounded, color: CropColors.green800),
            title: Text(l.kisanCallCentre),
            subtitle: Text('1800-180-1551 · ${l.kisanCallCentreHint}'),
            onTap: () => openExternal(Uri.parse('tel:18001801551')),
          ),
          if (email != null)
            ListTile(
              leading: const Icon(Icons.mail_outline_rounded, color: CropColors.green800),
              title: Text(l.emailSupport),
              subtitle: Text(email),
              onTap: () => openExternal(Uri(scheme: 'mailto', path: email, query: 'subject=CropAI report ${r.id}')),
            ),
          if (status == 'UNREVIEWED')
            ListTile(
              leading: const Icon(Icons.person_search_rounded, color: CropColors.amber900),
              title: Text(l.requestExpert),
              onTap: () {
                Navigator.pop(context);
                unawaited(_requestExpert());
              },
            ),
          const SizedBox(height: 12),
        ]),
      ),
    );
  }

  String _reviewLabel(AppLocalizations l) {
    final verdict = r.review.verdict;
    if (verdict == 'CONFIRMED') return l.reviewConfirmed;
    if (verdict == 'CHALLENGED') return l.reviewChallenged;
    if (verdict == 'NEEDS_INFO') return l.reviewNeedsInfo;
    return (_reviewStatus ?? r.review.status) == 'PENDING' ? l.reviewPending : l.reviewNotRequested;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final assistant = ref.watch(assistantNameProvider);
    final lang = l.localeName;
    final savedAt = widget.loaded.savedAt;
    Widget gap([double h = 16]) => SizedBox(height: h);
    Widget section({String? eyebrow, required String title, String? subtitle, required Widget child, Widget? trailing}) => AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SectionHeader(eyebrow: eyebrow, title: title, subtitle: subtitle, trailing: trailing),
            gap(14),
            child,
          ]),
        );

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: widget.onRefresh,
        child: CustomScrollView(slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 360,
            backgroundColor: CropColors.green950,
            foregroundColor: Colors.white,
            title: Text(l.reportTitle),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(fit: StackFit.expand, children: [
                PrivateImage(path: r.imageUrl, semanticLabel: l.yourPhoto),
                const DecoratedBox(
                  decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0xE6000000), Color(0x33000000), Color(0x66000000)])),
                ),
                Positioned(
                  left: 20,
                  right: 20,
                  bottom: 20,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      StatusPill(label: l.yourPhoto, tone: PillTone.dark),
                      StatusPill(label: r.result.isHealthy ? l.looksHealthy : l.needsAttention, tone: r.result.isHealthy ? PillTone.good : PillTone.warn),
                    ]),
                    gap(12),
                    Row(children: [
                      CropAvatar(imageUrl: r.crop.imageUrl, size: 28),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          [r.crop.name, if (r.crop.detectedByModel) l.cropDetectedByModel, if (r.crop.selectedName != null && r.crop.selectedName != r.crop.name) l.selectedCrop(r.crop.selectedName!)].join(' · '),
                          style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ]),
                    gap(6),
                    Text(r.result.condition, style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white)),
                    gap(8),
                    Text('${l.aiScreeningNote} · ${r.model.version}', style: const TextStyle(color: Colors.white70, fontSize: 12.5)),
                  ]),
                ),
              ]),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(CropSpace.lg, CropSpace.lg, CropSpace.lg, 40),
            sliver: SliverList.list(children: [
              if (savedAt != null) OfflineBanner(savedAt: Fmt.dateTime(savedAt, lang)),
              Row(children: [
                const Icon(Icons.event_rounded, size: 16, color: CropColors.muted),
                const SizedBox(width: 6),
                Text(Fmt.dateTime(r.createdAt, lang), style: const TextStyle(color: CropColors.muted, fontWeight: FontWeight.w600)),
              ]),
              gap(12),
              // ---- summary (also the "Save image" content) ----
              RepaintBoundary(
                key: _summaryKey,
                child: FadeSlideIn(
                  child: AppCard(
                    child: Column(children: [
                      ScoreGauge(percent: r.result.scorePercent, healthy: r.result.isHealthy, label: l.modelScore),
                      gap(12),
                      if (r.explanation?.summary.isNotEmpty ?? false)
                        Text(r.explanation!.summary, textAlign: TextAlign.center, style: theme.textTheme.bodyLarge?.copyWith(color: CropColors.muted)),
                      gap(14),
                      Row(children: [
                        _Tile(icon: Icons.photo_camera_outlined, label: l.photoQuality, value: r.result.photoQuality == 'ok' ? l.qualityOk : l.qualityWeak, good: r.result.photoQuality == 'ok'),
                        const SizedBox(width: 8),
                        _Tile(icon: Icons.bug_report_outlined, label: l.severity, value: l.severityNotRated),
                        const SizedBox(width: 8),
                        _Tile(icon: Icons.verified_outlined, label: l.expertLabel, value: _reviewLabel(l), good: r.review.verdict == 'CONFIRMED'),
                      ]),
                      if (r.result.advisories.isNotEmpty) ...[
                        gap(12),
                        Wrap(spacing: 8, runSpacing: 8, children: [for (final a in r.result.advisories) StatusPill(label: a.label, tone: PillTone.warn, icon: Icons.warning_amber_rounded)]),
                        gap(8),
                        Text(l.uncertainResult, textAlign: TextAlign.center, style: const TextStyle(color: CropColors.amber900, fontSize: 13)),
                      ],
                      if (r.review.verdict != null) ...[
                        gap(12),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: CropColors.green100, borderRadius: BorderRadius.circular(16)),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${l.expertLabel}: ${_reviewLabel(l)}', style: const TextStyle(fontWeight: FontWeight.w800, color: CropColors.green900)),
                            if (r.review.correctedCondition != null) Text(l.expertSays(r.review.correctedCondition!)),
                            if (r.review.note != null) Text(r.review.note!, style: const TextStyle(color: CropColors.green900)),
                          ]),
                        ),
                      ] else if ((_reviewStatus ?? r.review.status) == 'PENDING') ...[
                        gap(12),
                        Text(l.expertWillReview, style: const TextStyle(color: CropColors.green800, fontWeight: FontWeight.w600)),
                      ],
                      gap(10),
                      Text(l.modelInfo(r.model.name, r.model.version), style: const TextStyle(fontSize: 11.5, color: CropColors.muted)),
                    ]),
                  ),
                ),
              ),
              gap(12),
              _ActionBar(
                speaking: _speaking,
                assistant: assistant,
                onListen: _listen,
                onAsk: () => context.go(Routes.assistantWith(diagnosisId: r.id)),
                onTalk: () => context.go(Routes.assistantWith(diagnosisId: r.id, voice: true)),
                onShare: _share,
                onSave: _saveImage,
                onSupport: _support,
              ),
              if (r.fieldNotes != null && !r.fieldNotes!.isEmpty) ...[gap(), _FieldNotesCard(notes: r.fieldNotes!)],
              gap(),
              section(eyebrow: l.whatToLookFor, title: l.topPredictions, subtitle: l.topPredictionsHint, child: TopPredictionBars(predictions: r.predictions)),
              gap(),
              // ---- Ask Mitra about this report ----
              AppCard(
                color: CropColors.green950,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(l.askMitra(assistant), style: theme.textTheme.titleLarge?.copyWith(color: Colors.white)),
                  gap(12),
                  for (final q in r.askMitra)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Material(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                        child: ListTile(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          title: Text(q, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                          trailing: const Icon(Icons.north_east_rounded, color: CropColors.green200),
                          onTap: () => context.go(Routes.assistantWith(diagnosisId: r.id, question: q)),
                        ),
                      ),
                    ),
                ]),
              ),
              if (r.actions.isNotEmpty) ...[
                gap(20),
                SectionHeader(
                  eyebrow: '${r.actions.length}',
                  title: l.whatToDo,
                  trailing: r.explanation?.sources.where((s) => s.url != null).isNotEmpty ?? false
                      ? TextButton(
                          onPressed: () => openExternal(Uri.parse(r.explanation!.sources.firstWhere((s) => s.url != null).url!)),
                          child: Text(l.sourceLabel(r.explanation!.sources.firstWhere((s) => s.url != null).title), maxLines: 1, overflow: TextOverflow.ellipsis),
                        )
                      : null,
                ),
                gap(10),
                ActionCards(actions: r.actions),
              ],
              gap(),
              section(
                title: l.whatToLookFor,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  for (final item in r.lookFor.items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(color: CropColors.green100, borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Icons.eco_outlined, size: 18, color: CropColors.green600),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Padding(padding: const EdgeInsets.only(top: 6), child: Text(item))),
                      ]),
                    ),
                  Text(r.lookFor.approved ? l.approvedSymptomsNote : l.generalScoutingNote, style: const TextStyle(fontSize: 12, color: CropColors.muted)),
                  if (r.explanation?.possibleCauses.isNotEmpty ?? false) ...[
                    gap(12),
                    Text(l.likelyCauses, style: const TextStyle(fontWeight: FontWeight.w800)),
                    gap(6),
                    Wrap(spacing: 6, runSpacing: 6, children: [for (final c in r.explanation!.possibleCauses) Chip(label: Text(c))]),
                  ],
                  if (r.explanation?.conditionExplanation.isNotEmpty ?? false)
                    Theme(
                      data: theme.copyWith(dividerColor: Colors.transparent),
                      child: ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: Text(l.readAboutCondition, style: const TextStyle(fontWeight: FontWeight.w800, color: CropColors.green800)),
                        children: [Text(r.explanation!.conditionExplanation, style: const TextStyle(color: CropColors.muted, height: 1.5))],
                      ),
                    ),
                ]),
              ),
              gap(),
              section(
                eyebrow: r.weather?.providerLabel,
                title: l.weatherAtCheck,
                child: r.weather == null
                    ? Text(l.weatherNoLocationReport, style: const TextStyle(color: CropColors.muted))
                    : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        WeatherTiles(weather: r.weather!),
                        if (r.weather!.forecast.isNotEmpty) ...[gap(14), Text(l.forecastTitle, style: const TextStyle(fontWeight: FontWeight.w700)), gap(8), ForecastChart(days: r.weather!.forecast)],
                        gap(8),
                        Text(
                          '${l.weatherSource(r.weather!.providerLabel, r.weather!.observedAt == null ? '' : Fmt.dateTime(r.weather!.observedAt!, lang))} · ${r.weather!.note ?? ''}',
                          style: const TextStyle(fontSize: 11.5, color: CropColors.muted),
                        ),
                      ]),
              ),
              gap(),
              section(title: l.photoComparison, subtitle: l.referenceOnly, child: PhotoComparison(photoPath: r.imageUrl, references: r.references)),
              gap(),
              section(
                eyebrow: l.checksCount(r.history.length),
                title: l.yourCropChecks(r.crop.name),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CropHistory(history: r.history, cropName: r.crop.name),
                  gap(14),
                  OutlinedButton.icon(onPressed: () => context.push(Routes.crops), icon: const Icon(Icons.photo_camera_outlined), label: Text(l.checkAgain)),
                ]),
              ),
              gap(),
              section(
                title: l.heatmapTitle,
                child: Row(children: [
                  const Icon(Icons.layers_clear_outlined, color: CropColors.muted),
                  const SizedBox(width: 10),
                  Expanded(child: Text(l.heatmapUnavailable, style: const TextStyle(color: CropColors.muted))),
                ]),
              ),
              gap(),
              AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(l.feedbackQuestion, style: theme.textTheme.titleMedium),
                  gap(10),
                  Row(children: [
                    Expanded(
                      child: _Choice(selected: _helpful == true, icon: Icons.thumb_up_alt_outlined, label: l.yes, onTap: () => _feedback(true)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Choice(selected: _helpful == false, icon: Icons.thumb_down_alt_outlined, label: l.no, onTap: () => _feedback(false)),
                    ),
                  ]),
                  if ((_reviewStatus ?? r.review.status) == 'UNREVIEWED') ...[
                    gap(12),
                    OutlinedButton.icon(onPressed: _requestExpert, icon: const Icon(Icons.person_search_outlined), label: Text(l.requestExpert)),
                  ],
                ]),
              ),
              gap(),
              Text('${r.disclaimer} · ${r.model.name} ${r.model.version}', style: const TextStyle(fontSize: 12, color: CropColors.muted)),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.label, required this.value, this.good = false});
  final IconData icon;
  final String label;
  final String value;
  final bool good;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          decoration: BoxDecoration(color: CropColors.cream, borderRadius: BorderRadius.circular(16)),
          child: Column(children: [
            Icon(icon, size: 20, color: good ? CropColors.green600 : CropColors.muted),
            const SizedBox(height: 6),
            Text(value, textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 11, color: CropColors.muted, fontWeight: FontWeight.w700)),
          ]),
        ),
      );
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.speaking,
    required this.assistant,
    required this.onListen,
    required this.onAsk,
    required this.onTalk,
    required this.onShare,
    required this.onSave,
    required this.onSupport,
  });
  final bool speaking;
  final String assistant;
  final VoidCallback onListen;
  final VoidCallback onAsk;
  final VoidCallback onTalk;
  final VoidCallback onShare;
  final VoidCallback onSave;
  final VoidCallback onSupport;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final items = [
      (speaking ? Icons.stop_circle_outlined : Icons.volume_up_rounded, speaking ? l.stopListening : l.listen, onListen, true),
      (Icons.chat_bubble_outline_rounded, l.askMitra(assistant), onAsk, false),
      (Icons.mic_none_rounded, l.talkLabel, onTalk, false),
      (Icons.share_outlined, l.share, onShare, false),
      (Icons.image_outlined, l.saveImage, onSave, false),
      (Icons.support_agent_rounded, l.contactSupport, onSupport, false),
    ];
    return LayoutBuilder(builder: (context, c) {
      final width = (c.maxWidth - 2 * 8) / 3;
      return Wrap(spacing: 8, runSpacing: 8, children: [
        for (final (icon, label, onTap, primary) in items)
          SizedBox(
            width: width,
            child: PressableScale(
              onTap: onTap,
              semanticLabel: label,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
                decoration: BoxDecoration(
                  color: primary ? CropColors.green800 : Colors.white,
                  borderRadius: BorderRadius.circular(CropRadii.tile),
                  border: primary ? null : Border.all(color: CropColors.border),
                ),
                child: Column(children: [
                  Icon(icon, color: primary ? Colors.white : CropColors.green800, size: 26),
                  const SizedBox(height: 6),
                  Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: primary ? Colors.white : CropColors.ink)),
                ]),
              ),
            ),
          ),
      ]);
    });
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.selected, required this.icon, required this.label, required this.onTap});
  final bool selected;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          backgroundColor: selected ? CropColors.green800 : Colors.white,
          foregroundColor: selected ? Colors.white : CropColors.green900,
        ),
        icon: Icon(icon),
        label: Text(label),
      );
}

class _FieldNotesCard extends StatelessWidget {
  const _FieldNotesCard({required this.notes});
  final FieldNotes notes;
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final captured = notes.capturedAt == null ? null : DateTime.tryParse(notes.capturedAt!);
    final chips = [
      for (final i in notes.items) (i.label, i.value),
      if (captured != null) (l.photoTime, Fmt.dateTime(captured, l.localeName)),
      if (notes.latitude != null) (l.farmLocationLabel, '${notes.latitude!.toStringAsFixed(2)}, ${notes.longitude!.toStringAsFixed(2)}'),
    ];
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SectionHeader(title: l.fieldNotesTitle),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final (label, value) in chips)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: CropColors.cream, borderRadius: BorderRadius.circular(14), border: Border.all(color: CropColors.border)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: const TextStyle(fontSize: 11, color: CropColors.muted, fontWeight: FontWeight.w700)),
                Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
            ),
        ]),
        if (notes.note != null && notes.note!.isNotEmpty) ...[const SizedBox(height: 10), Text('“${notes.note}”', style: const TextStyle(fontStyle: FontStyle.italic))],
      ]),
    );
  }
}
