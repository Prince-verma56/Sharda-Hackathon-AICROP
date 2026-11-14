import 'dart:async';
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/error_messages.dart';
import '../../core/localization/generated/app_localizations.dart';
import '../../core/network/connectivity.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';

/// White rounded surface (web: `rounded-[28px] bg-white ring-1 ring-border`).
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(CropSpace.xl), this.color, this.onTap});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Padding(padding: padding, child: child);
    return Material(
      color: color ?? Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(CropRadii.card),
        side: color == null ? const BorderSide(color: CropColors.border) : BorderSide.none,
      ),
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? content : InkWell(onTap: onTap, child: content),
    );
  }
}

/// Small upper-case label above a section title (web "eyebrow").
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, this.eyebrow, required this.title, this.trailing, this.subtitle});
  final String? eyebrow;
  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hindi = Localizations.localeOf(context).languageCode == 'hi';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          flex: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (eyebrow != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    hindi ? eyebrow! : eyebrow!.toUpperCase(),
                    style: theme.textTheme.labelSmall?.copyWith(color: CropColors.green600, fontWeight: FontWeight.w800, letterSpacing: hindi ? 0 : 1.6),
                  ),
                ),
              Text(title, style: theme.textTheme.titleLarge),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(subtitle!, style: theme.textTheme.bodySmall?.copyWith(color: CropColors.muted)),
              ],
            ],
          ),
        ),
        // Bounded so a long trailing action (e.g. "Source: …") can never squeeze the title.
        if (trailing != null) Flexible(flex: 2, child: Align(alignment: Alignment.bottomRight, child: trailing)),
      ],
    );
  }
}

enum PillTone { good, warn, neutral, info, dark }

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, this.tone = PillTone.neutral, this.icon});
  final String label;
  final PillTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      PillTone.good => (CropColors.green100, CropColors.green900),
      PillTone.warn => (CropColors.amber50, CropColors.amber900),
      PillTone.info => (CropColors.sky100, CropColors.sky900),
      PillTone.dark => (Colors.black54, Colors.white),
      PillTone.neutral => (CropColors.cream, CropColors.ink),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(CropRadii.chip),
        border: tone == PillTone.warn ? Border.all(color: CropColors.amber200) : null,
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 6)],
        Flexible(child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12.5), overflow: TextOverflow.ellipsis)),
      ]),
    );
  }
}

/// Error with an icon, a plain sentence and a retry button.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry, this.compact = false});
  final Object error;
  final VoidCallback? onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final message = errorMessage(error, l);
    final body = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: const BoxDecoration(color: CropColors.amber50, shape: BoxShape.circle),
          child: const Icon(Icons.cloud_off_rounded, color: CropColors.amber900, size: 30),
        ),
        const SizedBox(height: 14),
        Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
        if (onRetry != null) ...[
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: Text(l.retry)),
        ],
      ],
    );
    return compact ? Padding(padding: const EdgeInsets.all(16), child: body) : Center(child: Padding(padding: const EdgeInsets.all(28), child: body));
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.hint, this.action});
  final IconData icon;
  final String title;
  final String? hint;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 84,
            height: 84,
            decoration: const BoxDecoration(color: CropColors.green100, shape: BoxShape.circle),
            child: Icon(icon, size: 40, color: CropColors.green600),
          ),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
          if (hint != null) ...[
            const SizedBox(height: 6),
            Text(hint!, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: CropColors.muted)),
          ],
          if (action != null) ...[const SizedBox(height: 18), action!],
        ]),
      ),
    );
  }
}

/// Shown at the top of screens while the phone has no network.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key, this.savedAt});
  final String? savedAt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider);
    final l = AppLocalizations.of(context);
    return AnimatedSize(
      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 250),
      child: online && savedAt == null
          ? const SizedBox(width: double.infinity)
          : Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(color: CropColors.amber50, borderRadius: BorderRadius.circular(CropRadii.button), border: Border.all(color: CropColors.amber200)),
              child: Row(children: [
                const Icon(Icons.wifi_off_rounded, size: 18, color: CropColors.amber900),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    [if (!online) l.offlineBanner, if (savedAt != null) l.savedCopyFrom(savedAt!)].join(' · '),
                    style: const TextStyle(color: CropColors.amber900, fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
              ]),
            ),
    );
  }
}

/// Soft pulsing placeholder for loading content (static when animations are disabled).
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 120, this.width = double.infinity, this.radius = CropRadii.card});
  final double height;
  final double width;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      unawaited(_c.repeat(reverse: true));
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
      builder: (context, _) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: Color.lerp(const Color(0xFFECEBE3), const Color(0xFFF4F3EE), _c.value),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 4, this.height = 96});
  final int count;
  final double height;
  @override
  Widget build(BuildContext context) => ListView.separated(
        padding: const EdgeInsets.all(CropSpace.lg),
        itemCount: count,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, _) => Skeleton(height: height),
      );
}

// ---- images -------------------------------------------------------------------------------

/// Private images (diagnosis photo, reference photos, samples) are fetched through the
/// authenticated ApiClient (token refresh included) and cached in memory for the session only.
final privateImageProvider = FutureProvider.autoDispose.family<Uint8List, String>((ref, path) async {
  final link = ref.keepAlive();
  Timer? timer;
  ref.onCancel(() => timer = Timer(const Duration(minutes: 10), link.close));
  ref.onResume(() => timer?.cancel());
  ref.onDispose(() => timer?.cancel());
  return ref.read(apiClientProvider).getBytes(path);
});

class PrivateImage extends ConsumerWidget {
  const PrivateImage({super.key, required this.path, this.fit = BoxFit.cover, this.semanticLabel});
  final String path;
  final BoxFit fit;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final image = ref.watch(privateImageProvider(path));
    return image.when(
      data: (bytes) => Image.memory(bytes, fit: fit, gaplessPlayback: true, semanticLabel: semanticLabel),
      loading: () => const Skeleton(radius: 0),
      error: (_, _) => Container(
        color: CropColors.green100,
        alignment: Alignment.center,
        child: const Icon(Icons.image_not_supported_outlined, color: CropColors.green600),
      ),
    );
  }
}

/// Public crop photo from the backend (`/images/crops/<id>.jpg`), or a leaf icon.
class CropAvatar extends ConsumerWidget {
  const CropAvatar({super.key, required this.imageUrl, this.size = 44, this.radius});
  final String? imageUrl;
  final double size;
  final double? radius;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = BorderRadius.circular(radius ?? size / 2);
    final fallback = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: CropColors.green100, borderRadius: r),
      child: Icon(Icons.eco_rounded, color: CropColors.green600, size: size * 0.5),
    );
    if (imageUrl == null) return fallback;
    final url = ref.watch(apiClientProvider).resolve(imageUrl!).toString();
    return ClipRRect(
      borderRadius: r,
      child: Image.network(url, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, _, _) => fallback),
    );
  }
}
