import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/errors/error_messages.dart';
import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/permissions/permission_service.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/widgets/brand.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/links.dart';
import '../application/assistant_controller.dart';
import '../data/assistant_repository.dart';

class AssistantScreen extends ConsumerStatefulWidget {
  const AssistantScreen({super.key, this.diagnosisId, this.initialQuestion, this.autoVoice = false, this.conversationId, this.fresh = false});
  final String? diagnosisId;
  final String? initialQuestion;
  final bool autoVoice;
  final String? conversationId;
  final bool fresh;

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  bool _startedInitial = false;

  AssistantArgs get _args => (diagnosisId: widget.diagnosisId, conversationId: widget.conversationId, fresh: widget.fresh);

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send([String? text]) {
    final value = (text ?? _text.text).trim();
    if (value.isEmpty) return;
    _text.clear();
    unawaited(ref.read(assistantControllerProvider(_args).notifier).ask(value));
  }

  Future<void> _startVoice() async {
    final l = AppLocalizations.of(context);
    final ctrl = ref.read(assistantControllerProvider(_args).notifier);
    final outcome = await PermissionService.ensure(
      context,
      permission: Permission.microphone,
      title: l.micPermissionTitle,
      body: l.micPermissionBody(ref.read(assistantControllerProvider(_args)).assistantName),
      icon: Icons.mic_none_rounded,
    );
    if (outcome != PermissionOutcome.granted) {
      ctrl.micDenied();
      return;
    }
    await ctrl.startCall();
  }

  void _maybeStartInitial(AssistantState s) {
    if (_startedInitial || s.loading || s.loadError != null) return;
    _startedInitial = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.initialQuestion != null) _send(widget.initialQuestion);
      if (widget.autoVoice && s.voiceAvailable) unawaited(_startVoice());
    });
  }

  String _voiceError(String code, AppLocalizations l) => switch (code) {
        'MIC_DENIED' => l.voiceMicDenied,
        'VOICE_NOT_CONFIGURED' => l.voiceNotAvailable,
        'SILENCE' => l.voiceSilenceEnded,
        'TIMEOUT' => l.voiceTimeout,
        _ => l.voiceFailed,
      };

  void _menu(AssistantState s) {
    final l = AppLocalizations.of(context);
    final ctrl = ref.read(assistantControllerProvider(_args).notifier);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      builder: (sheet) => Consumer(builder: (context, ref, _) {
        final state = ref.watch(assistantControllerProvider(_args));
        return SafeArea(
          child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(8, 0, 8, 16), children: [
            ListTile(
              leading: const Icon(Icons.add_comment_outlined),
              title: Text(l.newChat),
              onTap: () {
                Navigator.pop(sheet);
                context.go(Routes.assistantWith(fresh: true));
              },
            ),
            ListTile(
              leading: const Icon(Icons.tune_rounded),
              title: Text(l.mitraSettingsTitle(state.assistantName)),
              onTap: () {
                Navigator.pop(sheet);
                context.push(Routes.settings);
              },
            ),
            const Divider(),
            SwitchListTile(
              value: state.chatHistoryConsent,
              title: Text(l.saveTextChats),
              onChanged: (v) => ctrl.setConsent(chatHistory: v).catchError((Object e) => _toast(errorMessage(e, l))),
            ),
            SwitchListTile(
              value: state.voiceTranscriptConsent,
              title: Text(l.saveVoiceTranscripts),
              subtitle: Text(l.audioNeverRecorded),
              onChanged: (v) => ctrl.setConsent(voiceTranscripts: v).catchError((Object e) => _toast(errorMessage(e, l))),
            ),
            const Divider(),
            Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 4), child: Text(l.savedChats, style: Theme.of(context).textTheme.titleMedium)),
            if (state.saved.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(l.noSavedChats, style: const TextStyle(color: CropColors.muted))),
            for (final c in state.saved)
              ListTile(
                leading: const Icon(Icons.chat_outlined),
                title: Text(c.title ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: c.at == null ? null : Text(Fmt.dateTime(c.at!, l.localeName)),
                onTap: () {
                  Navigator.pop(sheet);
                  context.go(Routes.assistantWith(conversationId: c.id));
                },
              ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded, color: CropColors.danger),
              title: Text(l.deleteHistory, style: const TextStyle(color: CropColors.danger)),
              onTap: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (d) => AlertDialog(
                    content: Text(l.deleteHistoryConfirm),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(d, false), child: Text(l.cancel)),
                      FilledButton(style: FilledButton.styleFrom(backgroundColor: CropColors.danger), onPressed: () => Navigator.pop(d, true), child: Text(l.deleteHistory)),
                    ],
                  ),
                );
                if (ok != true) return;
                try {
                  await ctrl.deleteHistory();
                  if (sheet.mounted) Navigator.pop(sheet);
                  _toast(l.historyDeleted);
                } catch (e) {
                  _toast(errorMessage(e, l));
                }
              },
            ),
          ]),
        );
      }),
    );
  }

  void _toast(String text) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final s = ref.watch(assistantControllerProvider(_args));
    _maybeStartInitial(s);
    ref.listen(assistantControllerProvider(_args).select((s) => s.messages.length), (_, _) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) unawaited(_scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut));
      });
    });

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(color: CropColors.green950, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: const LeafMark(size: 22, color: CropColors.green200),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.assistantName, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(l.assistantSubtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: CropColors.muted, fontWeight: FontWeight.w600)),
            ]),
          ),
        ]),
        actions: [
          if (s.voiceAvailable && !s.inCall)
            IconButton.filled(
              tooltip: l.voiceStart,
              style: IconButton.styleFrom(backgroundColor: CropColors.green800, minimumSize: const Size(48, 48)),
              onPressed: _startVoice,
              icon: const Icon(Icons.call_rounded),
            ),
          IconButton(onPressed: s.loading ? null : () => _menu(s), icon: const Icon(Icons.more_vert_rounded)),
        ],
      ),
      body: s.loading
          ? const SkeletonList(count: 5, height: 64)
          : s.loadError != null
              ? ErrorView(error: s.loadError!, onRetry: ref.read(assistantControllerProvider(_args).notifier).load)
              : Column(children: [
                  if (s.report != null) _ReportBanner(report: s.report!),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(children: [
                      Icon(s.persisted ? Icons.cloud_done_outlined : Icons.timer_outlined, size: 14, color: CropColors.muted),
                      const SizedBox(width: 6),
                      Expanded(child: Text(s.persisted ? l.chatSaved : l.chatNotSaved, style: const TextStyle(fontSize: 12, color: CropColors.muted))),
                    ]),
                  ),
                  Expanded(
                    child: s.messages.isEmpty
                        ? _EmptyChat(onAsk: _send)
                        : ListView.builder(
                            controller: _scroll,
                            reverse: true,
                            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                            itemCount: s.messages.length,
                            itemBuilder: (context, i) {
                              final m = s.messages[s.messages.length - 1 - i];
                              return _Bubble(
                                message: m,
                                assistantName: s.assistantName,
                                onRetry: () => ref.read(assistantControllerProvider(_args).notifier).retry(m),
                              );
                            },
                          ),
                  ),
                  if (s.voice != VoicePhase.idle) _VoicePanel(state: s, args: _args, onRetry: _startVoice, errorText: s.voiceError == null ? null : _voiceError(s.voiceError!, l)),
                  _Composer(controller: _text, sending: s.sending, hint: l.composerHint(s.assistantName), onSend: () => _send()),
                ]),
    );
  }
}

class _ReportBanner extends StatelessWidget {
  const _ReportBanner({required this.report});
  final ReportContext report;
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Material(
        color: report.isHealthy ? CropColors.green100 : CropColors.amber50,
        borderRadius: BorderRadius.circular(CropRadii.button),
        child: ListTile(
          dense: true,
          leading: SizedBox(
            width: 40,
            height: 40,
            child: ClipRRect(borderRadius: BorderRadius.circular(10), child: PrivateImage(path: '/api/v1/images/diagnoses/${report.id}')),
          ),
          title: Text(l.aboutReport(report.crop, report.condition), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push(Routes.diagnosis(report.id)),
        ),
      ),
    );
  }
}

class _EmptyChat extends StatelessWidget {
  const _EmptyChat({required this.onAsk});
  final ValueChanged<String> onAsk;
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return ListView(padding: const EdgeInsets.all(20), children: [
      const SizedBox(height: 20),
      const Center(child: PulseRing(child: CircleAvatar(radius: 40, backgroundColor: CropColors.green950, child: LeafMark(size: 40, color: CropColors.green200)))),
      const SizedBox(height: 20),
      Text(l.emptyChatTitle, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 6),
      Text(l.emptyChatHint, textAlign: TextAlign.center, style: const TextStyle(color: CropColors.muted)),
      const SizedBox(height: 20),
      for (final q in [l.quickQ1, l.quickQ2, l.quickQ3, l.quickQ4])
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: OutlinedButton(
            style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft),
            onPressed: () => onAsk(q),
            child: Row(children: [Expanded(child: Text(q)), const Icon(Icons.north_east_rounded, size: 18)]),
          ),
        ),
    ]);
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.assistantName, required this.onRetry});
  final ChatMessage message;
  final String assistantName;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final farmer = message.role == ChatRole.farmer;
    final mode = switch (message.mode) { 'ai' => l.modeAi, 'records' => l.modeRecords, 'web' => l.modeWeb, 'guide' => l.modeGuide, _ => null };
    String failedText() {
      final code = message.text;
      if (code == 'GENAI_NOT_CONFIGURED') return l.mitraNotConfigured;
      if (code == 'offline') return l.errOffline;
      return errorMessage(ApiException(kind: ApiErrorKind.unknown, code: code), l) == l.errGeneric ? l.answerFailed : errorMessage(ApiException(kind: ApiErrorKind.unknown, code: code), l);
    }

    final bubble = Container(
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: BoxDecoration(
        color: message.failed ? CropColors.amber50 : (farmer ? CropColors.green800 : Colors.white),
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(20),
          topRight: const Radius.circular(20),
          bottomLeft: Radius.circular(farmer ? 20 : 6),
          bottomRight: Radius.circular(farmer ? 6 : 20),
        ),
        border: farmer ? null : Border.all(color: message.failed ? CropColors.amber200 : CropColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        if (message.pending)
          Row(mainAxisSize: MainAxisSize.min, children: [
            const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
            const SizedBox(width: 10),
            Text(l.mitraThinking(assistantName), style: const TextStyle(color: CropColors.muted)),
          ])
        else if (message.failed)
          InkWell(
            onTap: onRetry,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.refresh_rounded, color: CropColors.amber900, size: 18),
              const SizedBox(width: 6),
              Flexible(child: Text(failedText(), style: const TextStyle(color: CropColors.amber900, fontWeight: FontWeight.w600))),
            ]),
          )
        else
          SelectableText(message.text, style: TextStyle(color: farmer ? Colors.white : CropColors.ink, fontSize: 15.5, height: 1.45)),
        if (message.voice || mode != null) ...[
          const SizedBox(height: 4),
          Row(mainAxisSize: MainAxisSize.min, children: [
            if (message.voice) Icon(Icons.mic_rounded, size: 12, color: farmer ? CropColors.green200 : CropColors.muted),
            if (mode != null) Text(mode, style: const TextStyle(fontSize: 11, color: CropColors.muted, fontWeight: FontWeight.w700)),
          ]),
        ],
        if (message.sources.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(l.sourcesLabel, style: const TextStyle(fontSize: 11, color: CropColors.muted, fontWeight: FontWeight.w800)),
          for (final src in message.sources)
            InkWell(
              onTap: () => openExternal(Uri.parse(src.url)),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Text('↗ ${src.title.isEmpty ? src.site : src.title}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: CropColors.green800, fontWeight: FontWeight.w600, fontSize: 13)),
              ),
            ),
        ],
      ]),
    );
    return Align(alignment: farmer ? Alignment.centerRight : Alignment.centerLeft, child: FadeSlideIn(offset: 8, child: bubble));
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.sending, required this.hint, required this.onSend});
  final TextEditingController controller;
  final bool sending;
  final String hint;
  final VoidCallback onSend;
  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              maxLength: 500,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(hintText: hint, counterText: '', contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14)),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            tooltip: AppLocalizations.of(context).send,
            style: IconButton.styleFrom(backgroundColor: CropColors.green800, minimumSize: const Size(54, 54)),
            onPressed: sending ? null : onSend,
            icon: sending ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send_rounded),
          ),
        ]),
      ),
    );
  }
}

class _VoicePanel extends ConsumerWidget {
  const _VoicePanel({required this.state, required this.args, required this.onRetry, this.errorText});
  final AssistantState state;
  final AssistantArgs args;
  final VoidCallback onRetry;
  final String? errorText;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final ctrl = ref.read(assistantControllerProvider(args).notifier);
    final status = switch (state.voice) {
      VoicePhase.preparing || VoicePhase.connecting => l.voiceConnecting,
      VoicePhase.ended => l.voiceEnded,
      VoicePhase.failed => errorText ?? l.voiceFailed,
      _ => switch (state.live) {
          LiveState.farmer => l.voiceYouSpeaking,
          LiveState.mitra => l.voiceMitraSpeaking(state.assistantName),
          LiveState.processing => l.voiceThinking,
          LiveState.listening => l.voiceListening,
        },
    };
    return AnimatedSize(
      duration: reduceMotion(context) ? Duration.zero : const Duration(milliseconds: 250),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 4),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
        decoration: BoxDecoration(color: CropColors.green950, borderRadius: BorderRadius.circular(CropRadii.tile)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Icon(state.voice == VoicePhase.failed ? Icons.error_outline_rounded : Icons.graphic_eq_rounded, color: CropColors.green200),
            const SizedBox(width: 10),
            Expanded(child: Text(status, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
          ]),
          if (state.inCall) ...[
            const SizedBox(height: 8),
            VoiceWaveform(level: state.voice == VoicePhase.live ? state.level : 0.05, color: state.live == LiveState.farmer ? Colors.white : CropColors.green200, height: 56),
            if (state.partial.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('“${state.partial}”', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70, fontStyle: FontStyle.italic)),
              ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(backgroundColor: Colors.transparent, foregroundColor: Colors.white, side: const BorderSide(color: Colors.white38)),
                  onPressed: state.voice == VoicePhase.live ? ctrl.toggleMute : null,
                  icon: Icon(state.muted ? Icons.mic_off_rounded : Icons.mic_rounded),
                  label: Text(state.muted ? l.voiceUnmute : l.voiceMute),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: CropColors.danger),
                  onPressed: ctrl.endCall,
                  icon: const Icon(Icons.call_end_rounded),
                  label: Text(l.voiceEnd),
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text(l.voiceMicActivityNote, style: const TextStyle(color: Colors.white38, fontSize: 11)),
          ] else if (state.voice == VoicePhase.failed || state.voice == VoicePhase.ended) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: CropColors.green600, minimumSize: const Size(0, 46)),
                onPressed: state.voiceError == 'VOICE_NOT_CONFIGURED' ? null : onRetry,
                icon: const Icon(Icons.call_rounded),
                label: Text(state.voice == VoicePhase.failed ? l.retry : l.voiceStart),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}
