import 'dart:async';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vapi/vapi.dart';

import '../../../core/errors/api_exception.dart';
import '../data/assistant_repository.dart';

typedef AssistantArgs = ({String? diagnosisId, String? conversationId, bool fresh});

enum VoicePhase { idle, preparing, connecting, live, ended, failed }

enum LiveState { listening, farmer, processing, mitra }

class AssistantState {
  const AssistantState({
    this.loading = true,
    this.loadError,
    this.assistantName = 'Mitra',
    this.conversationId,
    this.persisted = false,
    this.messages = const [],
    this.report,
    this.chatHistoryConsent = false,
    this.voiceTranscriptConsent = false,
    this.saved = const [],
    this.voiceAvailable = false,
    this.sending = false,
    this.voice = VoicePhase.idle,
    this.live = LiveState.listening,
    this.partial = '',
    this.muted = false,
    this.voiceError,
  });

  final bool loading;
  final Object? loadError;
  final String assistantName;
  final String? conversationId;
  final bool persisted;
  final List<ChatMessage> messages;
  final ReportContext? report;
  final bool chatHistoryConsent;
  final bool voiceTranscriptConsent;
  final List<({String id, String? title, DateTime? at})> saved;
  final bool voiceAvailable;
  final bool sending;
  final VoicePhase voice;
  final LiveState live;
  final String partial;
  final bool muted;
  /// code: VOICE_FAILED | MIC_DENIED | VOICE_NOT_CONFIGURED | SILENCE | TIMEOUT
  final String? voiceError;

  bool get inCall => voice == VoicePhase.preparing || voice == VoicePhase.connecting || voice == VoicePhase.live;

  /// 0..1 activity level for the waveform (the mobile SDK reports speaking state, not amplitude).
  double get level => switch (live) {
        LiveState.farmer => (0.55 + min(partial.length, 60) / 150).clamp(0.0, 1.0),
        LiveState.mitra => 0.75,
        LiveState.processing => 0.3,
        LiveState.listening => 0.12,
      };

  AssistantState copyWith({
    bool? loading,
    Object? loadError,
    String? assistantName,
    String? conversationId,
    bool? persisted,
    List<ChatMessage>? messages,
    ReportContext? report,
    bool? chatHistoryConsent,
    bool? voiceTranscriptConsent,
    List<({String id, String? title, DateTime? at})>? saved,
    bool? voiceAvailable,
    bool? sending,
    VoicePhase? voice,
    LiveState? live,
    String? partial,
    bool? muted,
    String? voiceError,
    bool clearVoiceError = false,
    bool clearConversation = false,
  }) =>
      AssistantState(
        loading: loading ?? this.loading,
        loadError: loadError,
        assistantName: assistantName ?? this.assistantName,
        conversationId: clearConversation ? null : (conversationId ?? this.conversationId),
        persisted: persisted ?? this.persisted,
        messages: messages ?? this.messages,
        report: report ?? this.report,
        chatHistoryConsent: chatHistoryConsent ?? this.chatHistoryConsent,
        voiceTranscriptConsent: voiceTranscriptConsent ?? this.voiceTranscriptConsent,
        saved: saved ?? this.saved,
        voiceAvailable: voiceAvailable ?? this.voiceAvailable,
        sending: sending ?? this.sending,
        voice: voice ?? this.voice,
        live: live ?? this.live,
        partial: partial ?? this.partial,
        muted: muted ?? this.muted,
        voiceError: clearVoiceError ? null : (voiceError ?? this.voiceError),
      );
}

/// Pending voice turn, saved to the server when the other speaker starts (same as the web client).
class _VoiceTurn {
  _VoiceTurn(this.role, this.text, this.turnId, this.modality, this.messageId);
  final ChatRole role;
  String text;
  final String turnId;
  final String modality;
  final String messageId;
}

/// One Mitra conversation, two ways to talk: text (POST /assistant/chat) and voice (Vapi call
/// configured by POST /voice/session). Both continue the SAME conversation id, so a report
/// discussed by voice can be followed up by text and vice versa.
class AssistantController extends Notifier<AssistantState> {
  AssistantController(this.args);
  final AssistantArgs args;

  final _random = Random();
  VapiClient? _vapi;
  VapiCall? _call;
  StreamSubscription<VapiEvent>? _events;
  String? _voiceSessionId;
  DateTime? _callStarted;
  String _callKey = '';
  int _voiceSeq = 0;
  _VoiceTurn? _pending;
  ({String turnId, String messageId})? _modelTurn;
  final Set<String> _droppedTurns = {};
  bool _sawModelOutput = false;
  bool _greetingSpeaking = false;
  String _assistantHeard = '';
  String? _greeting;
  String? _endedReason;
  Timer? _connectWatchdog;

  AssistantRepository get _repo => ref.read(assistantRepositoryProvider);

  @override
  AssistantState build() {
    ref.onDispose(() {
      _connectWatchdog?.cancel();
      unawaited(_teardownCall());
    });
    unawaited(Future<void>.microtask(load));
    return const AssistantState();
  }

  String _uid() => '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}${_random.nextInt(1 << 30).toRadixString(36)}';

  Future<void> load() async {
    state = state.copyWith(loading: true);
    try {
      final t = await _repo.thread(conversationId: args.conversationId, diagnosisId: args.diagnosisId, fresh: args.fresh);
      state = AssistantState(
        loading: false,
        assistantName: t.assistantName,
        conversationId: t.conversationId,
        persisted: t.persisted,
        messages: t.messages,
        report: t.report,
        chatHistoryConsent: t.chatHistoryConsent,
        voiceTranscriptConsent: t.voiceTranscriptConsent,
        saved: t.saved,
        voiceAvailable: t.voiceAvailable,
      );
    } catch (e) {
      state = state.copyWith(loading: false, loadError: e);
    }
  }

  /// The diagnosis this chat focuses on (only when opened from a report).
  String? get _focusDiagnosis => state.report?.focused == true ? state.report!.id : args.diagnosisId;

  // ---- text ------------------------------------------------------------------------------------

  Future<void> ask(String question) async {
    final q = question.trim();
    if (q.isEmpty || state.sending) return;
    // During a live call, typed text joins the voice conversation (Mitra answers aloud).
    if (state.voice == VoicePhase.live && _call != null) {
      await _call!.send({'type': 'add-message', 'message': {'role': 'user', 'content': q}, 'triggerResponseEnabled': true});
      _beginVoiceTurn(ChatRole.farmer, q, modality: 'text');
      _flushVoiceTurn();
      return;
    }
    final pendingId = _uid();
    state = state.copyWith(
      sending: true,
      messages: [
        ...state.messages.where((m) => !(m.failed && m.retryText == q)),
        ChatMessage(id: _uid(), role: ChatRole.farmer, text: q),
        ChatMessage(id: pendingId, role: ChatRole.mitra, text: '', pending: true),
      ],
    );
    try {
      final answer = await _repo.ask(message: q, conversationId: state.conversationId, diagnosisId: _focusDiagnosis, turnId: 'text-${_uid()}');
      state = state.copyWith(
        sending: false,
        conversationId: answer.conversationId,
        persisted: answer.persisted,
        messages: [
          for (final m in state.messages) m.id == pendingId ? m.copyWith(text: answer.answer, pending: false, sources: answer.sources, mode: answer.mode) : m,
        ],
      );
    } catch (e) {
      final conversation = e is ApiException ? e.details['conversationId'] as String? : null;
      final code = e is ApiException ? e.code : null;
      state = state.copyWith(
        sending: false,
        conversationId: conversation,
        messages: [
          for (final m in state.messages) m.id == pendingId ? m.copyWith(pending: false, failed: true, retryText: q, text: code ?? (e is ApiException ? e.kind.name : 'error')) : m,
        ],
      );
    }
  }

  Future<void> retry(ChatMessage failed) async {
    final text = failed.retryText;
    if (text == null) return;
    // drop the failed answer and the question it belonged to, then ask again
    final index = state.messages.indexWhere((m) => m.id == failed.id);
    final messages = [...state.messages];
    if (index > 0 && messages[index - 1].role == ChatRole.farmer && messages[index - 1].text == text) messages.removeAt(index - 1);
    messages.removeWhere((m) => m.id == failed.id);
    state = state.copyWith(messages: messages);
    await ask(text);
  }

  Future<void> setConsent({bool? chatHistory, bool? voiceTranscripts}) async {
    final result = await _repo.setConsent(chatHistory: chatHistory, voiceTranscripts: voiceTranscripts);
    state = state.copyWith(chatHistoryConsent: result.chatHistory, voiceTranscriptConsent: result.voiceTranscripts);
  }

  Future<void> deleteHistory() async {
    await _repo.deleteHistory();
    state = state.copyWith(messages: const [], saved: const [], clearConversation: true, persisted: false);
  }

  // ---- voice -----------------------------------------------------------------------------------

  /// Starts a Vapi call with the assistant the SERVER built for this farmer (microphone
  /// permission must already be granted by the screen, after explaining why).
  Future<void> startCall() async {
    if (state.inCall) return;
    state = state.copyWith(voice: VoicePhase.preparing, clearVoiceError: true, muted: false, partial: '', live: LiveState.listening);
    _callKey = 'call-${_uid()}';
    _voiceSeq = 0;
    _endedReason = null;
    try {
      final session = await _repo.startVoice(conversationId: state.conversationId, diagnosisId: _focusDiagnosis);
      _voiceSessionId = session.voiceSessionId;
      _greeting = session.assistant['firstMessage'] as String?;
      state = state.copyWith(voice: VoicePhase.connecting, conversationId: session.conversationId, persisted: session.persisted);
      _connectWatchdog = Timer(const Duration(seconds: 25), () {
        if (state.voice == VoicePhase.connecting) unawaited(_fail('TIMEOUT'));
      });
      _vapi ??= VapiClient(session.publicKey);
      final call = await _vapi!.start(assistant: session.assistant);
      _call = call;
      _events = call.onEvent.listen(_onEvent, onError: (_) => unawaited(_fail('VOICE_FAILED')));
    } on ApiException catch (e) {
      await _fail(e.code == 'VOICE_NOT_CONFIGURED' ? 'VOICE_NOT_CONFIGURED' : 'VOICE_FAILED');
    } catch (e) {
      await _fail(e.toString().toLowerCase().contains('permission') ? 'MIC_DENIED' : 'VOICE_FAILED');
    }
  }

  void _onEvent(VapiEvent event) {
    switch (event.label) {
      case 'call-start':
        _connectWatchdog?.cancel();
        _callStarted = DateTime.now();
        _modelTurn = null;
        _droppedTurns.clear();
        _sawModelOutput = false;
        _assistantHeard = '';
        state = state.copyWith(voice: VoicePhase.live, live: LiveState.listening);
        _greetingSpeaking = _greeting != null;
        if (_greeting != null) _beginVoiceTurn(ChatRole.mitra, _greeting!);
      case 'speech-start':
        state = state.copyWith(live: LiveState.mitra);
      case 'speech-end':
        state = state.copyWith(live: LiveState.listening);
      case 'call-end':
        unawaited(_ended());
      case 'message':
        final value = event.value;
        if (value is Map) _onMessage(value.cast<String, dynamic>());
    }
  }

  void _onMessage(Map<String, dynamic> m) {
    switch (m['type']) {
      case 'model-output':
        final output = m['output'];
        if (output is! String) return; // tool-call chunks
        _sawModelOutput = true;
        _assistantHeard = '';
        _appendMitraToken(m['turnId'] is String ? m['turnId'] as String : 'reply-$_voiceSeq', output);
      case 'transcript':
        final text = '${m['transcript'] ?? ''}'.trim();
        if (m['role'] == 'user') {
          if (m['transcriptType'] == 'partial') {
            state = state.copyWith(partial: text, live: LiveState.farmer);
          } else {
            state = state.copyWith(partial: '', live: LiveState.processing);
            _appendFarmerSpeech(text);
          }
        } else if (m['transcriptType'] == 'final' && !_sawModelOutput) {
          _assistantHeard = '$_assistantHeard $text'; // fallback only
        }
      case 'speech-update':
        if (m['role'] == 'user') {
          state = state.copyWith(live: m['status'] == 'started' ? LiveState.farmer : LiveState.processing);
        } else {
          state = state.copyWith(live: m['status'] == 'started' ? LiveState.mitra : LiveState.listening);
          if (m['status'] == 'stopped') {
            final heard = _assistantHeard.trim();
            _assistantHeard = '';
            if (_greetingSpeaking) {
              _greetingSpeaking = false;
            } else if (!_sawModelOutput && heard.isNotEmpty) {
              _beginVoiceTurn(ChatRole.mitra, heard);
            }
          }
        }
      case 'user-interrupted':
        state = state.copyWith(live: LiveState.farmer);
        if (_modelTurn != null) _droppedTurns.add(_modelTurn!.turnId);
      case 'status-update':
        if (m['status'] == 'ended') _endedReason = m['endedReason'] as String?;
    }
  }

  void _appendFarmerSpeech(String text) {
    if (text.isEmpty) return;
    final turn = _pending;
    if (turn == null || turn.role != ChatRole.farmer || turn.modality != 'voice_transcript') {
      _beginVoiceTurn(ChatRole.farmer, text);
      return;
    }
    turn.text = '${turn.text} $text';
    _updateMessage(turn.messageId, turn.text);
  }

  void _appendMitraToken(String turnId, String token) {
    if (_droppedTurns.contains(turnId)) return;
    final current = _modelTurn;
    final turn = _pending;
    if (current?.turnId == turnId && turn?.role == ChatRole.mitra) {
      turn!.text += token;
      _updateMessage(current!.messageId, turn.text);
      return;
    }
    if (token.trim().isEmpty) return;
    final messageId = _beginVoiceTurn(ChatRole.mitra, token.trimLeft());
    _modelTurn = (turnId: turnId, messageId: messageId);
  }

  String _beginVoiceTurn(ChatRole role, String text, {String modality = 'voice_transcript'}) {
    _flushVoiceTurn();
    _voiceSeq++;
    final id = _uid();
    _pending = _VoiceTurn(role, text, '$_callKey:$_voiceSeq', modality, id);
    state = state.copyWith(messages: [...state.messages, ChatMessage(id: id, role: role, text: text, voice: modality == 'voice_transcript')]);
    return id;
  }

  void _updateMessage(String id, String text) =>
      state = state.copyWith(messages: [for (final m in state.messages) m.id == id ? m.copyWith(text: text) : m]);

  /// Saves the finished turn (24 h working copy; PostgreSQL only with the matching consent).
  void _flushVoiceTurn() {
    final turn = _pending;
    _pending = null;
    final conversationId = state.conversationId;
    if (turn == null || conversationId == null || turn.text.trim().isEmpty) return;
    unawaited(_repo
        .recordTurns(conversationId, [(role: turn.role == ChatRole.farmer ? 'farmer' : 'mitra', text: turn.text.trim(), turnId: turn.turnId, modality: turn.modality)])
        .catchError((_) {}));
  }

  void toggleMute() {
    final call = _call;
    if (call == null) return;
    final next = !state.muted;
    call.setMuted(next);
    state = state.copyWith(muted: next);
  }

  Future<void> endCall() async {
    await _call?.stop();
    await _ended();
  }

  Future<void> _ended() async {
    _connectWatchdog?.cancel();
    _flushVoiceTurn();
    final silence = _endedReason?.contains('silence') ?? false;
    state = state.copyWith(
      voice: state.voice == VoicePhase.failed ? VoicePhase.failed : VoicePhase.ended,
      partial: '',
      live: LiveState.listening,
      voiceError: silence ? 'SILENCE' : null,
    );
    await _teardownCall();
  }

  Future<void> _fail(String code) async {
    _connectWatchdog?.cancel();
    state = state.copyWith(voice: VoicePhase.failed, voiceError: code, partial: '');
    await _teardownCall();
  }

  Future<void> _teardownCall() async {
    await _events?.cancel();
    _events = null;
    final call = _call;
    _call = null;
    if (call != null) {
      try {
        await call.stop();
      } catch (_) {}
      call.dispose();
    }
    final session = _voiceSessionId;
    _voiceSessionId = null;
    if (session != null) {
      final seconds = _callStarted == null ? 0 : DateTime.now().difference(_callStarted!).inSeconds;
      _callStarted = null;
      unawaited(_repo.endVoice(session, seconds).catchError((_) {}));
    }
  }

  void micDenied() => state = state.copyWith(voice: VoicePhase.failed, voiceError: 'MIC_DENIED');
}

final assistantControllerProvider =
    NotifierProvider.autoDispose.family<AssistantController, AssistantState, AssistantArgs>(AssistantController.new);
