import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:material_ui/material_ui.dart';
import 'package:go_router/go_router.dart';

import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../shared/widgets/common.dart';
import '../data/report_models.dart';

/// Half-ring gauge of the model score (web: ScoreGauge). Animates once unless motion is reduced.
class ScoreGauge extends StatelessWidget {
  const ScoreGauge({super.key, required this.percent, required this.healthy, required this.label});
  final int percent;
  final bool healthy;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = healthy ? CropColors.green600 : CropColors.amber500;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: percent / 100),
      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 1100),
      curve: Curves.easeOutCubic,
      builder: (context, value, _) => SizedBox(
        width: 220,
        height: 124,
        child: CustomPaint(
          painter: _GaugePainter(value: value, color: color),
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('${(value * 100).round()}%', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, letterSpacing: -1.5, height: 1)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 12, color: CropColors.muted, fontWeight: FontWeight.w700)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({required this.value, required this.color});
  final double value;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 16.0;
    final rect = Rect.fromCircle(center: Offset(size.width / 2, size.height - 4), radius: size.width / 2 - stroke);
    final track = Paint()
      ..color = CropColors.green100
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, math.pi, math.pi, false, track);
    canvas.drawArc(rect, math.pi, math.pi * value.clamp(0, 1), false, track..color = color);
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.value != value || old.color != color;
}

/// The model's real top-k scores as horizontal bars (no invented values; tiny scores hidden).
class TopPredictionBars extends StatelessWidget {
  const TopPredictionBars({super.key, required this.predictions});
  final List<Prediction> predictions;

  @override
  Widget build(BuildContext context) {
    final shown = predictions.where((p) => p.rank == 1 || p.score >= 0.01).take(5).toList();
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Column(children: [
      for (final p in shown)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(p.condition, style: TextStyle(fontWeight: p.rank == 1 ? FontWeight.w800 : FontWeight.w600))),
              Text(Fmt.percent(p.score), style: const TextStyle(fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
            ]),
            const SizedBox(height: 6),
            LayoutBuilder(builder: (context, c) {
              return Stack(children: [
                Container(height: 12, decoration: BoxDecoration(color: CropColors.green100, borderRadius: BorderRadius.circular(8))),
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: p.score.clamp(0, 1)),
                  duration: reduce ? Duration.zero : Duration(milliseconds: 700 + p.rank * 120),
                  curve: Curves.easeOutCubic,
                  builder: (context, v, _) => Container(
                    height: 12,
                    width: math.max(6, c.maxWidth * v),
                    decoration: BoxDecoration(color: p.rank == 1 ? CropColors.green800 : CropColors.green500.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ]);
            }),
          ]),
        ),
    ]);
  }
}

class ActionCards extends StatelessWidget {
  const ActionCards({super.key, required this.actions});
  final List<ReportAction> actions;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Column(children: [
      for (final a in actions)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AppCard(
            padding: const EdgeInsets.all(14),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _KindIcon(kind: a.kind),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    '${a.step}. ${switch (a.kind) { ActionKind.inspect => l.kindInspect, ActionKind.prevent => l.kindPrevent, ActionKind.expert => l.kindExpert, ActionKind.test => l.kindTest }}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: CropColors.muted),
                  ),
                  const SizedBox(height: 4),
                  Text(a.text, style: const TextStyle(fontSize: 15, height: 1.4)),
                ]),
              ),
            ]),
          ),
        ),
    ]);
  }
}

class _KindIcon extends StatelessWidget {
  const _KindIcon({required this.kind});
  final ActionKind kind;
  @override
  Widget build(BuildContext context) {
    final (icon, bg, fg) = switch (kind) {
      ActionKind.inspect => (Icons.visibility_outlined, CropColors.green100, CropColors.green800),
      ActionKind.prevent => (Icons.shield_outlined, CropColors.green800, Colors.white),
      ActionKind.expert => (Icons.person_search_outlined, CropColors.amber100, CropColors.amber900),
      ActionKind.test => (Icons.science_outlined, CropColors.sky100, CropColors.sky900),
    };
    return Container(width: 44, height: 44, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: fg));
  }
}

/// This crop's checks as tiles (green = healthy, amber = attention, opacity = score), plus a score
/// line only when there are at least 3 real checks. Scores are model confidence, not recovery.
class CropHistory extends StatelessWidget {
  const CropHistory({super.key, required this.history, required this.cropName});
  final List<HistoryPoint> history;
  final String cropName;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final h in history)
          Tooltip(
            message: '${Fmt.date(h.createdAt, l.localeName)} · ${h.condition} · ${Fmt.percent(h.score)}',
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: h.current ? null : () => context.push(Routes.diagnosis(h.id)),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: (h.isHealthy ? CropColors.green500 : CropColors.amber500).withValues(alpha: 0.35 + h.score * 0.65),
                  borderRadius: BorderRadius.circular(10),
                  border: h.current ? Border.all(color: CropColors.ink, width: 2.5) : null,
                ),
              ),
            ),
          ),
      ]),
      const SizedBox(height: 10),
      Text(l.historyLegend, style: const TextStyle(fontSize: 12, color: CropColors.muted)),
      if (history.length <= 1) ...[
        const SizedBox(height: 12),
        Text(l.firstCheck, style: const TextStyle(color: CropColors.muted)),
      ],
      if (history.length >= 3) ...[
        const SizedBox(height: 18),
        Text(l.scoreTrend, style: const TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        SizedBox(
          height: 150,
          child: LineChart(LineChartData(
            minY: 0,
            maxY: 100,
            gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: 25, getDrawingHorizontalLine: (_) => const FlLine(color: CropColors.border, strokeWidth: 1)),
            borderData: FlBorderData(show: false),
            titlesData: const FlTitlesData(
              topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 30, interval: 50)),
            ),
            lineBarsData: [
              LineChartBarData(
                spots: [for (var i = 0; i < history.length; i++) FlSpot(i.toDouble(), (history[i].score * 100).roundToDouble())],
                isCurved: false,
                color: CropColors.green800,
                barWidth: 3,
                dotData: FlDotData(
                  getDotPainter: (spot, _, _, i) => FlDotCirclePainter(
                    radius: history[i].current ? 6 : 4,
                    color: history[i].isHealthy ? CropColors.green500 : CropColors.amber500,
                    strokeColor: Colors.white,
                    strokeWidth: 2,
                  ),
                ),
              ),
            ],
          )),
        ),
        const SizedBox(height: 6),
        Text(l.scoreTrendNote, style: const TextStyle(fontSize: 12, color: CropColors.muted)),
      ],
    ]);
  }
}

/// Farmer's photo next to approved reference photos — clearly labelled which is which.
class PhotoComparison extends StatelessWidget {
  const PhotoComparison({super.key, required this.photoPath, required this.references});
  final String photoPath;
  final List<ReferencePhoto> references;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    Widget tile(Widget image, String caption, String? credit, {Color? badge, String? badgeText}) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(
            aspectRatio: 1,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: Stack(fit: StackFit.expand, children: [
                image,
                if (badgeText != null)
                  Positioned(left: 8, top: 8, child: StatusPill(label: badgeText, tone: badge == CropColors.green800 ? PillTone.dark : PillTone.neutral)),
              ]),
            ),
          ),
          const SizedBox(height: 6),
          Text(caption, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          if (credit != null) Text(credit, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: CropColors.muted)),
        ]);

    final items = [
      tile(PrivateImage(path: photoPath), l.yourPhoto, null, badge: CropColors.green800, badgeText: l.yourPhoto),
      for (final r in references)
        r.imageUrl == null
            ? tile(
                Container(
                  color: CropColors.cream,
                  padding: const EdgeInsets.all(8),
                  alignment: Alignment.center,
                  // Tiles can be ~90 dp on small phones: scale the note down instead of overflowing.
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: SizedBox(
                      width: 110,
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.hide_image_outlined, color: CropColors.muted),
                        const SizedBox(height: 6),
                        Text(l.noReferencePhoto, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11.5, color: CropColors.muted)),
                      ]),
                    ),
                  ),
                ),
                r.label,
                null,
              )
            : tile(PrivateImage(path: r.imageUrl!), r.label, r.credit, badgeText: l.referencePhoto),
    ];
    return LayoutBuilder(builder: (context, c) {
      final columns = items.length >= 3 ? 3 : 2;
      final width = (c.maxWidth - (columns - 1) * 10) / columns;
      return Wrap(spacing: 10, runSpacing: 12, children: [for (final i in items) SizedBox(width: width, child: i)]);
    });
  }
}
