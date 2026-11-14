import 'package:material_ui/material_ui.dart';

import '../../core/theme/app_theme.dart';

/// The CropAI leaf mark — same 32×32 path as the web logo (components/marketing/home/brand.tsx).
class LeafMark extends StatelessWidget {
  const LeafMark({super.key, this.size = 28, this.color = CropColors.green600});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => CustomPaint(size: Size.square(size), painter: _LeafPainter(color));
}

class _LeafPainter extends CustomPainter {
  _LeafPainter(this.color);
  final Color color;

  // M27.5 4.5C14 4.2 5.2 10.6 5 21.4c0 2 .4 3.9 1.1 5.6C8 20.5 13 15.4 19.6 12.6
  // 14.4 16 10.4 20.7 8.4 27.3c1.5.4 3 .6 4.6.5C23.4 27.3 28.3 17.3 27.5 4.5Z
  static Path leafPath() => Path()
    ..moveTo(27.5, 4.5)
    ..cubicTo(14, 4.2, 5.2, 10.6, 5, 21.4)
    ..cubicTo(5, 23.4, 5.4, 25.3, 6.1, 27.0)
    ..cubicTo(8, 20.5, 13, 15.4, 19.6, 12.6)
    ..cubicTo(14.4, 16, 10.4, 20.7, 8.4, 27.3)
    ..cubicTo(9.9, 27.7, 11.4, 27.9, 13.0, 27.8)
    ..cubicTo(23.4, 27.3, 28.3, 17.3, 27.5, 4.5)
    ..close();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 32, size.height / 32);
    canvas.drawPath(leafPath(), Paint()..color = color);
  }

  @override
  bool shouldRepaint(_LeafPainter old) => old.color != color;
}

/// "🍃 CropAI" lockup used on splash and login.
class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key, required this.name, this.dark = false, this.size = 30});
  final String name;
  final bool dark;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      LeafMark(size: size, color: dark ? CropColors.green200 : CropColors.green600),
      const SizedBox(width: 8),
      Text(
        name,
        style: TextStyle(fontFamily: 'Manrope', fontSize: size * 0.85, fontWeight: FontWeight.w700, letterSpacing: -0.6, color: dark ? Colors.white : CropColors.ink),
      ),
    ]);
  }
}
