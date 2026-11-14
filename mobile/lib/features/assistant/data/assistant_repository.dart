import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/utilities/json.dart';

/// Mitra = the SAME backend assistant as the web (LangGraph workflow, farmer context, safety
/// rules, PostgreSQL history with consent). The app never talks to an LLM or Vapi's private API.

enum ChatRole { farmer, mitra }

class ChatSource {
  const ChatSource({required this.title, required this.url, required this.site});
  final String title;
  final String url;
  final String site;
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.text,
    this.voice = false,
    this.pending = false,
    this.failed = false,
    this.retryText,
    this.sources = const [],
    this.mode,
  });
  final String id;
  final ChatRole role;
  final String text;
  final bool voice;
  final bool pending;
  final bool failed;
  final String? retryText;
  final List<ChatSource> sources;
  /// ai | records | web | guide
  final String? mode;

  ChatMessage copyWith({String? text, bool? pending, bool? failed, String? retryText, List<ChatSource>? sources, String? mode}) => ChatMessage(
        id: id,
        role: role,
        text: text ?? this.text,
        voice: voice,
        pending: pending ?? this.pending,
        failed: failed ?? this.failed,
        retryText: retryText ?? this.retryText,
        sources: sources ?? this.sources,
        mode: mode ?? this.mode,
      );
}

class ReportContext {
  const ReportContext({required this.id, required this.focused, required this.crop, required this.condition, required this.isHealthy});
  final String id;
  final bool focused;
  final String crop;
  final String condition;
  final bool isHealthy;
}

class MitraThread {
  const MitraThread({
    required this.assistantName,
    required this.conversationId,
    required this.persisted,
    required this.messages,
    required this.report,
    required this.chatHistoryConsent,
    required this.voiceTranscriptConsent,
    required this.saved,
    required this.voiceAvailable,
  });
  final String assistantName;
  final String? conversationId;
  final bool persisted;
  final List<ChatMessage> messages;
  final ReportContext? report;
  final bool chatHistoryConsent;
  final bool voiceTranscriptConsent;
  final List<({String id, String? title, DateTime? at})> saved;
  final bool voiceAvailable;

  factory MitraThread.fromJson(Json j) {
    final consent = j.obj('consent') ?? const {};
    final report = j.obj('report');
    return MitraThread(
      assistantName: j.strOrNull('assistantName') ?? 'Mitra',
      conversationId: j.strOrNull('conversationId'),
      persisted: j.boolean('persisted'),
      messages: j
          .objects('messages')
          .map((m) => ChatMessage(id: m.str('id'), role: m.strOrNull('role') == 'farmer' ? ChatRole.farmer : ChatRole.mitra, text: m.strOrNull('text') ?? '', voice: m.strOrNull('channel') == 'voice'))
          .toList(),
      report: report == null
          ? null
          : ReportContext(id: report.str('id'), focused: report.boolean('focused'), crop: report.strOrNull('crop') ?? '', condition: report.strOrNull('condition') ?? '', isHealthy: report.boolean('isHealthy')),
      chatHistoryConsent: consent.boolean('chatHistory'),
      voiceTranscriptConsent: consent.boolean('voiceTranscripts'),
      saved: j.objects('savedConversations').map((c) => (id: c.str('id'), title: c.strOrNull('title'), at: c.date('lastMessageAt'))).toList(),
      voiceAvailable: j.boolean('voiceAvailable'),
    );
  }
}

class ChatAnswer {
  const ChatAnswer({required this.answer, required this.conversationId, required this.persisted, required this.mode, required this.sources});
  final String answer;
  final String conversationId;
  final bool persisted;
  final String? mode;
  final List<ChatSource> sources;
}

class VoiceSession {
  const VoiceSession({required this.voiceSessionId, required this.publicKey, required this.assistant, required this.conversationId, required this.persisted});
  final String voiceSessionId;
  /// Vapi PUBLIC key (safe for clients); the private key stays on the server
  final String publicKey;
  /// assistant config built on the server from authenticated context (LangGraph instructions,
  /// farmer context, history, voice + transcriber settings, signed session token)
  final Map<String, dynamic> assistant;
  final String conversationId;
  final bool persisted;
}

class MitraSettings {
  const MitraSettings({required this.effective, required this.overrides, required this.groups});
  final Map<String, String> effective;
  final Map<String, String?> overrides;
  final List<({String key, Map<String, String> title, Map<String, String> help, List<({String value, Map<String, String> label, Map<String, String> hint, String? sample})> options})> groups;

  static Map<String, String> _lang(Json? j) => {'en': j?.strOrNull('en') ?? '', 'hi': j?.strOrNull('hi') ?? j?.strOrNull('en') ?? ''};

  factory MitraSettings.fromJson(Json j) {
    final effective = j.obj('effective') ?? const {};
    final overrides = j.obj('overrides') ?? const {};
    return MitraSettings(
      effective: {for (final e in effective.entries) if (e.value is String) e.key: e.value! as String},
      overrides: {for (final e in overrides.entries) e.key: e.value is String ? e.value! as String : null},
      groups: j
          .objects('options')
          .map((g) => (
                key: g.str('key'),
                title: _lang(g.obj('title')),
                help: _lang(g.obj('help')),
                options: g.objects('options').map((o) => (value: o.str('value'), label: _lang(o.obj('label')), hint: _lang(o.obj('hint')), sample: o.strOrNull('sample'))).toList(),
              ))
          .toList(),
    );
  }
}

class AssistantRepository {
  AssistantRepository(this._api);
  final ApiClient _api;

  static List<ChatSource> _sources(Json j) =>
      j.objects('sources').map((s) => ChatSource(title: s.strOrNull('title') ?? '', url: s.strOrNull('url') ?? '', site: s.strOrNull('site') ?? '')).where((s) => s.url.startsWith('https://')).toList();

  Future<MitraThread> thread({String? conversationId, String? diagnosisId, bool fresh = false}) => _api.get(
        '/api/v1/assistant/thread',
        query: {'conversationId': conversationId, 'diagnosisId': diagnosisId, if (fresh) 'new': '1'},
        parse: (d) => MitraThread.fromJson(asJson(d)),
      );

  /// One Mitra answer (LLM calls can take a while). Not retried automatically.
  Future<ChatAnswer> ask({required String message, String? conversationId, String? diagnosisId, required String turnId}) => _api.post(
        '/api/v1/assistant/chat',
        timeout: const Duration(seconds: 75),
        body: {'message': message, 'conversationId': conversationId, 'diagnosisId': diagnosisId, 'turnId': turnId},
        parse: (d) {
          final j = asJson(d);
          return ChatAnswer(answer: j.str('answer'), conversationId: j.str('conversationId'), persisted: j.boolean('persisted'), mode: j.strOrNull('mode'), sources: _sources(j));
        },
      );

  Future<({bool chatHistory, bool voiceTranscripts})> setConsent({bool? chatHistory, bool? voiceTranscripts}) => _api.put(
        '/api/v1/assistant/consent',
        body: {'chatHistory': ?chatHistory, 'voiceTranscripts': ?voiceTranscripts},
        parse: (d) {
          final j = asJson(d);
          return (chatHistory: j.boolean('chatHistory'), voiceTranscripts: j.boolean('voiceTranscripts'));
        },
      );

  Future<void> deleteHistory() => _api.delete('/api/v1/assistant/conversations', parse: (d) => d);

  Future<VoiceSession> startVoice({String? conversationId, String? diagnosisId}) => _api.post(
        '/api/v1/voice/session',
        body: {'conversationId': conversationId, 'diagnosisId': diagnosisId},
        parse: (d) {
          final j = asJson(d);
          return VoiceSession(
            voiceSessionId: j.str('voiceSessionId'),
            publicKey: j.str('publicKey'),
            assistant: Map<String, dynamic>.from(j.obj('assistant') ?? const {}),
            conversationId: j.str('conversationId'),
            persisted: j.boolean('persisted'),
          );
        },
      );

  Future<void> endVoice(String voiceSessionId, int durationSeconds) =>
      _api.post('/api/v1/voice/session', body: {'end': voiceSessionId, 'durationSeconds': durationSeconds}, parse: (d) => d);

  /// Finished call turns (transcripts / typed text) — stored only with the matching consent.
  Future<void> recordTurns(String conversationId, List<({String role, String text, String turnId, String modality})> turns) => _api.post(
        '/api/v1/assistant/conversations/$conversationId/turns',
        body: {
          'turns': [for (final t in turns) {'role': t.role, 'text': t.text, 'turnId': t.turnId, 'modality': t.modality}],
        },
        parse: (d) => d,
      );

  Future<MitraSettings> settings() => _api.get('/api/v1/assistant/settings', parse: (d) => MitraSettings.fromJson(asJson(d)));

  Future<MitraSettings> saveSetting(String key, String? value) =>
      _api.put('/api/v1/assistant/settings', body: {key: value}, parse: (d) => MitraSettings.fromJson(asJson(d)));
}

final assistantRepositoryProvider = Provider<AssistantRepository>((ref) => AssistantRepository(ref.watch(apiClientProvider)));
