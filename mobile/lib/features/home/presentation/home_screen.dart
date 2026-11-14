import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/localization/generated/app_localizations.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utilities/formatters.dart';
import '../../../shared/animations/motion.dart';
import '../../../shared/models/farmer_models.dart';
import '../../../shared/services/farmer_repository.dart';
import '../../../shared/widgets/common.dart';
import '../../authentication/application/auth_controller.dart';
import '../../weather/presentation/weather_widgets.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final home = ref.watch(homeProvider);
    final assistant = ref.watch(assistantNameProvider);
    final auth = ref.watch(authControllerProvider);
    final fallbackName = auth is AuthSignedIn ? auth.me.farmer?.preferredName : null;
    final data = home.value?.value;
    final name = data?.preferredName ?? fallbackName;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(homeProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(CropSpace.lg, CropSpace.md, CropSpace.lg, CropSpace.xxl),
            children: [
              Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name == null || name.isEmpty ? l.greetingNoName : l.greeting(name), style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 4),
                    Text(l.homeQuestion, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: CropColors.muted)),
                  ]),
                ),
                _BellButton(count: data?.unreadNotifications ?? 0),
              ]),
              const SizedBox(height: CropSpace.lg),
              OfflineBanner(savedAt: home.value?.savedAt == null ? null : Fmt.dateTime(home.value!.savedAt!, l.localeName)),
              if (data?.notice != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: CropColors.amber50, borderRadius: BorderRadius.circular(CropRadii.button), border: Border.all(color: CropColors.amber200)),
                  child: Text(data!.notice!, style: const TextStyle(color: CropColors.amber900)),
                ),
              FadeSlideIn(child: _CheckHero(onTap: () => context.push(Routes.crops))),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 80),
                    child: _ActionTile(
                      icon: Icons.mic_rounded,
                      color: CropColors.green800,
                      title: l.actionTalk(assistant),
                      hint: l.actionTalkHint,
                      dark: true,
                      onTap: () => context.go(Routes.assistant),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 140),
                    child: _ActionTile(
                      icon: Icons.description_rounded,
                      color: CropColors.green100,
                      title: l.actionReports,
                      hint: l.checksCount(data?.checks ?? 0),
                      onTap: () => context.go(Routes.history),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              FadeSlideIn(
                delay: const Duration(milliseconds: 200),
                child: _ActionTile(
                  icon: Icons.account_balance_rounded,
                  color: CropColors.sage,
                  title: l.actionLearn,
                  hint: l.actionLearnHint,
                  wide: true,
                  onTap: () => context.push(Routes.resources),
                ),
              ),
              const SizedBox(height: CropSpace.xl),
              ...home.when(
                loading: () => const [Skeleton(height: 110), SizedBox(height: 12), Skeleton(height: 200)],
                error: (e, _) => [AppCard(child: ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(homeProvider)))],
                data: (cached) => _details(context, cached.value, l),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _details(BuildContext context, HomeData data, AppLocalizations l) {
    final lang = l.localeName;
    return [
      if (data.latest != null) ...[
        SectionHeader(eyebrow: l.latestCheck, title: data.latest!.crop.name),
        const SizedBox(height: 10),
        _LatestCheck(check: data.latest!),
        const SizedBox(height: CropSpace.xl),
      ],
      SectionHeader(eyebrow: data.farmLabel, title: l.weatherTitle),
      const SizedBox(height: 10),
      AppCard(
        child: data.weather == null
            ? Row(children: [
                const Icon(Icons.cloud_outlined, color: CropColors.green600, size: 28),
                const SizedBox(width: 12),
                Expanded(child: Text(data.weatherStatus == 'no_location' ? l.weatherAddLocation : l.weatherUnavailable)),
                if (data.weatherStatus == 'no_location') IconButton(onPressed: () => context.go(Routes.profile), icon: const Icon(Icons.arrow_forward_rounded)),
              ])
            : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                WeatherTiles(weather: data.weather!, showRain72h: false),
                if (data.weather!.forecast.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(l.forecastTitle, style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  ForecastChart(days: data.weather!.forecast),
                ],
                const SizedBox(height: 10),
                Text(
                  '${l.weatherSource(data.weather!.providerLabel, data.weather!.observedAt == null ? '' : Fmt.dateTime(data.weather!.observedAt!, lang))} · ${data.weather!.note ?? ''}',
                  style: const TextStyle(fontSize: 11.5, color: CropColors.muted),
                ),
              ]),
      ),
      if (data.crops.isNotEmpty) ...[
        const SizedBox(height: CropSpace.xl),
        SectionHeader(title: l.myCrops),
        const SizedBox(height: 10),
        SizedBox(
          height: 108,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: data.crops.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, i) => PressableScale(
              onTap: () => context.push(Routes.crops),
              child: SizedBox(
                width: 84,
                child: Column(children: [
                  CropAvatar(imageUrl: data.crops[i].imageUrl, size: 72, radius: 22),
                  const SizedBox(height: 6),
                  Text(data.crops[i].name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                ]),
              ),
            ),
          ),
        ),
      ],
      if (data.videos.isNotEmpty) ...[
        const SizedBox(height: CropSpace.xl),
        SectionHeader(title: l.videosTitle),
        const SizedBox(height: 10),
        for (final v in data.videos)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AppCard(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: SizedBox(
                    width: 84,
                    height: 56,
                    child: v.thumbnailUrl == null ? Container(color: CropColors.green100, child: const Icon(Icons.play_circle_outline, color: CropColors.green800)) : PrivateImage(path: v.thumbnailUrl!),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(v.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700))),
              ]),
            ),
          ),
      ],
    ];
  }
}

class _BellButton extends StatelessWidget {
  const _BellButton({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) {
    return Badge(
      isLabelVisible: count > 0,
      label: Text('$count'),
      backgroundColor: CropColors.green600,
      child: IconButton.outlined(
        iconSize: 26,
        style: IconButton.styleFrom(backgroundColor: Colors.white, side: const BorderSide(color: CropColors.border), minimumSize: const Size(52, 52)),
        tooltip: AppLocalizations.of(context).notificationsTitle,
        onPressed: () => context.push(Routes.notifications),
        icon: const Icon(Icons.notifications_none_rounded),
      ),
    );
  }
}

/// The primary action: a big photo card (web: "Check my crop" hero over leaf.jpg).
class _CheckHero extends StatelessWidget {
  const _CheckHero({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return PressableScale(
      onTap: onTap,
      semanticLabel: l.actionCheckCrop,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(CropRadii.card),
        child: SizedBox(
          height: 210,
          child: Stack(fit: StackFit.expand, children: [
            Image.asset('assets/images/leaf.jpg', fit: BoxFit.cover),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomLeft,
                  end: Alignment.topRight,
                  colors: [CropColors.green950.withValues(alpha: 0.92), CropColors.green900.withValues(alpha: 0.55), Colors.black.withValues(alpha: 0.05)],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(CropSpace.xl),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const StatusPill(label: 'AI', tone: PillTone.dark, icon: Icons.auto_awesome),
                const Spacer(),
                Text(l.actionCheckCrop, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white)),
                const SizedBox(height: 4),
                Row(children: [
                  Expanded(child: Text(l.actionCheckCropHint, style: const TextStyle(color: CropColors.green200, fontWeight: FontWeight.w600))),
                  PulseRing(
                    color: CropColors.green200,
                    child: Container(
                      width: 58,
                      height: 58,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                      child: const Icon(Icons.photo_camera_rounded, color: CropColors.green800, size: 28),
                    ),
                  ),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.color, required this.title, required this.hint, required this.onTap, this.dark = false, this.wide = false});
  final IconData icon;
  final Color color;
  final String title;
  final String hint;
  final VoidCallback onTap;
  final bool dark;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final fg = dark ? Colors.white : CropColors.ink;
    final iconBox = Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(color: dark ? Colors.white.withValues(alpha: 0.14) : Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Icon(icon, color: dark ? Colors.white : CropColors.green800, size: 28),
    );
    final texts = Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(title, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 16.5, height: 1.2)),
      const SizedBox(height: 4),
      Text(hint, style: TextStyle(color: dark ? CropColors.green200 : CropColors.muted, fontWeight: FontWeight.w600, fontSize: 13)),
    ]);
    return PressableScale(
      onTap: onTap,
      semanticLabel: title,
      child: Container(
        constraints: BoxConstraints(minHeight: wide ? 0 : 150),
        padding: const EdgeInsets.all(CropSpace.lg),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(CropRadii.card)),
        child: wide
            ? Row(children: [iconBox, const SizedBox(width: 14), Expanded(child: texts), Icon(Icons.arrow_forward_rounded, color: fg)])
            : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [iconBox, const SizedBox(height: 18), texts]),
      ),
    );
  }
}

class _LatestCheck extends StatelessWidget {
  const _LatestCheck({required this.check});
  final CheckSummary check;
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return AppCard(
      padding: const EdgeInsets.all(12),
      onTap: () => context.push(Routes.diagnosis(check.id)),
      child: Row(children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: SizedBox(width: 76, height: 76, child: check.thumbnailUrl == null ? CropAvatar(imageUrl: check.crop.imageUrl, size: 76, radius: 18) : PrivateImage(path: check.thumbnailUrl!)),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(check.condition, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('${l.modelScore} ${Fmt.percent(check.score)} · ${Fmt.date(check.createdAt, l.localeName)}', style: const TextStyle(color: CropColors.muted, fontSize: 13)),
            const SizedBox(height: 8),
            StatusPill(label: check.isHealthy ? l.looksHealthy : l.needsAttention, tone: check.isHealthy ? PillTone.good : PillTone.warn),
          ]),
        ),
        const Icon(Icons.chevron_right_rounded, color: CropColors.muted),
      ]),
    );
  }
}
