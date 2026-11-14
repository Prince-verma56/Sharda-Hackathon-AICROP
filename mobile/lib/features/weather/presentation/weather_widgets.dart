import 'package:fl_chart/fl_chart.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../shared/models/farmer_models.dart';

/// Four weather tiles (web: WeatherTile). Values are observations — never a disease forecast.
class WeatherTiles extends StatelessWidget {
  const WeatherTiles({super.key, required this.weather, this.showRain72h = true});
  final WeatherSnapshot weather;
  final bool showRain72h;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final tiles = [
      (Icons.thermostat_rounded, l.temperature, '${Fmt.number(weather.temperatureC)}°', null),
      (Icons.water_drop_outlined, l.humidity, '${Fmt.number(weather.humidityPct, digits: 0)}%', null),
      (Icons.grain_rounded, l.rain24h, Fmt.number(weather.rainLast24hMm), l.unitMm),
      if (showRain72h && weather.rainLast72hMm != null) (Icons.umbrella_outlined, l.rain72h, Fmt.number(weather.rainLast72hMm), l.unitMm),
    ];
    return LayoutBuilder(builder: (context, c) {
      final columns = c.maxWidth > 520 ? tiles.length : 2;
      final width = (c.maxWidth - (columns - 1) * 8) / columns;
      return Wrap(spacing: 8, runSpacing: 8, children: [
        for (final (icon, label, value, unit) in tiles)
          Container(
            width: width,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: CropColors.cream, borderRadius: BorderRadius.circular(CropRadii.tile), border: Border.all(color: CropColors.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, size: 20, color: CropColors.green600),
              const SizedBox(height: 8),
              Text.rich(TextSpan(children: [
                TextSpan(text: value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                if (unit != null) TextSpan(text: ' $unit', style: const TextStyle(fontSize: 12, color: CropColors.muted, fontWeight: FontWeight.w600)),
              ])),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 12, color: CropColors.muted, fontWeight: FontWeight.w700)),
            ]),
          ),
      ]);
    });
  }
}

/// Next days: rain bars (mm) with max temperature labels. Only real forecast values are drawn.
class ForecastChart extends StatelessWidget {
  const ForecastChart({super.key, required this.days});
  final List<WeatherDay> days;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final shown = days.take(5).toList();
    if (shown.isEmpty) return const SizedBox.shrink();
    final maxRain = shown.map((d) => d.rainMm ?? 0).fold<double>(0, (a, b) => a > b ? a : b);
    return SizedBox(
      height: 170,
      child: BarChart(
        BarChartData(
          maxY: maxRain <= 0 ? 5 : maxRain * 1.35,
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
          barTouchData: const BarTouchData(enabled: false),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 24,
                getTitlesWidget: (value, meta) {
                  final day = shown[value.toInt()];
                  return Text(day.maxC == null ? '—' : '${day.maxC!.round()}°', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: CropColors.amber900));
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 40,
                getTitlesWidget: (value, meta) {
                  final day = shown[value.toInt()];
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Column(children: [
                      Text(Fmt.weekday(day.date, lang), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      Text('${Fmt.number(day.rainMm)} mm', style: const TextStyle(fontSize: 10, color: CropColors.muted)),
                    ]),
                  );
                },
              ),
            ),
          ),
          barGroups: [
            for (var i = 0; i < shown.length; i++)
              BarChartGroupData(x: i, barRods: [
                BarChartRodData(
                  toY: shown[i].rainMm ?? 0,
                  width: 22,
                  color: CropColors.sky900.withValues(alpha: 0.75),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                  backDrawRodData: BackgroundBarChartRodData(show: true, toY: maxRain <= 0 ? 5 : maxRain * 1.35, color: CropColors.sky100),
                ),
              ]),
          ],
        ),
      ),
    );
  }
}
