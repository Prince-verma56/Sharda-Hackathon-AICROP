import 'dart:async';
import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../core/theme/app_theme.dart';

bool reduceMotion(BuildContext context) => MediaQuery.disableAnimationsOf(context);

/// Content entrance: fade + small upward slide, staggered by [delay]. Instant with reduced motion.
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({super.key, required this.child, this.delay = Duration.zero, this.offset = 18});
  final Widget child;
  final Duration delay;
  final double offset;

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  late final Animation<double> _curve = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      _c.value = 1;
    } else if (_c.value == 0 && _timer == null) {
      _timer = Timer(widget.delay, () {
        if (mounted) unawaited(_c.forward());
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _curve,
      builder: (context, child) => Opacity(
        opacity: _curve.value,
        child: Transform.translate(offset: Offset(0, widget.offset * (1 - _curve.value)), child: child),
      ),
      child: widget.child,
    );
  }
}

/// Tactile press feedback: the child scales down slightly while pressed.
class PressableScale extends StatefulWidget {
  const PressableScale({super.key, required this.child, required this.onTap, this.semanticLabel});
  final Widget child;
  final VoidCallback? onTap;
  final String? semanticLabel;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final scale = _down && !reduceMotion(context) ? 0.97 : 1.0;
    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: GestureDetector(
        onTapDown: widget.onTap == null ? null : (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(scale: scale, duration: const Duration(milliseconds: 120), child: widget.child),
      ),
    );
  }
}

/// Animated bars that react to who is speaking during a voice call. [level] 0..1 drives the
/// height; the Vapi mobile SDK exposes speaking state (not raw microphone amplitude), so the
/// level is derived from speech events and partial transcripts.
class VoiceWaveform extends StatefulWidget {
  const VoiceWaveform({super.key, required this.level, this.color = Colors.white, this.bars = 24, this.height = 72});
  final double level;
  final Color color;
  final int bars;
  final double height;

  @override
  State<VoiceWaveform> createState() => _VoiceWaveformState();
}

class _VoiceWaveformState extends State<VoiceWaveform> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      unawaited(_c.repeat());
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.height,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) => CustomPaint(
          size: Size.infinite,
          painter: _WavePainter(phase: _c.value * 2 * math.pi, level: widget.level.clamp(0.0, 1.0), color: widget.color, bars: widget.bars),
        ),
      ),
    );
  }
}

class _WavePainter extends CustomPainter {
  _WavePainter({required this.phase, required this.level, required this.color, required this.bars});
  final double phase;
  final double level;
  final Color color;
  final int bars;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final gap = size.width / bars;
    final barWidth = gap * 0.55;
    for (var i = 0; i < bars; i++) {
      final wave = (math.sin(phase + i * 0.55) + 1) / 2;
      final envelope = math.sin(math.pi * (i + 0.5) / bars);
      final h = size.height * (0.08 + envelope * (0.12 + 0.8 * level * (0.4 + 0.6 * wave)));
      final x = i * gap + (gap - barWidth) / 2;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x, (size.height - h) / 2, barWidth, h), Radius.circular(barWidth)),
        paint..color = color.withValues(alpha: 0.45 + 0.55 * envelope),
      );
    }
  }

  @override
  bool shouldRepaint(_WavePainter old) => old.phase != phase || old.level != level || old.color != color;
}

/// Breathing ring behind the scan button / microphone (static with reduced motion).
class PulseRing extends StatefulWidget {
  const PulseRing({super.key, required this.child, this.color = CropColors.green500, this.active = true});
  final Widget child;
  final Color color;
  final bool active;

  @override
  State<PulseRing> createState() => _PulseRingState();
}

class _PulseRingState extends State<PulseRing> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(PulseRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  void _sync() {
    if (!widget.active || reduceMotion(context)) {
      _c.stop();
      _c.value = 0;
    } else if (!_c.isAnimating) {
      unawaited(_c.repeat());
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => CustomPaint(
        painter: _RingPainter(progress: _c.value, color: widget.color),
        child: child,
      ),
      child: widget.child,
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.color});
  final double progress;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    if (progress == 0) return;
    final center = size.center(Offset.zero);
    final base = size.shortestSide / 2;
    for (final offset in [0.0, 0.5]) {
      final t = (progress + offset) % 1;
      canvas.drawCircle(center, base * (1 + t * 0.55), Paint()..color = color.withValues(alpha: 0.35 * (1 - t)));
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress;
}
