import 'package:material_ui/material_ui.dart';

/// CropAI design tokens — the same values as the web app (app/globals.css `--crop-*`).
abstract final class CropColors {
  static const ink = Color(0xFF161A14);
  static const green950 = Color(0xFF1C2E16);
  static const green900 = Color(0xFF26401E);
  static const green800 = Color(0xFF2F4C25); // primary
  static const green600 = Color(0xFF4A7A33);
  static const green500 = Color(0xFF5F9142);
  static const green200 = Color(0xFFC9E3B3);
  static const green100 = Color(0xFFE4F0D8);
  static const cream = Color(0xFFF7F6F1); // background (warm ivory)
  static const sage = Color(0xFFDDE7D2);
  static const card = Colors.white;
  static const border = Color(0xFFE4E2DA);
  static const muted = Color(0xFF6B6F66);

  // status (Tailwind amber / sky used by the web report)
  static const amber50 = Color(0xFFFFFBEB);
  static const amber100 = Color(0xFFFEF3C7);
  static const amber200 = Color(0xFFFDE68A);
  static const amber500 = Color(0xFFF59E0B);
  static const amber900 = Color(0xFF78350F);
  static const sky100 = Color(0xFFE0F2FE);
  static const sky900 = Color(0xFF0C4A6E);
  static const danger = Color(0xFFB42318);
}

abstract final class CropRadii {
  static const card = 28.0;
  static const tile = 20.0;
  static const button = 16.0;
  static const chip = 999.0;
}

abstract final class CropSpace {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const xxl = 28.0;
  /// Minimum touch target for farmers (larger than Material's 48).
  static const touch = 56.0;
}

abstract final class AppTheme {
  static ThemeData light() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: CropColors.green800,
      onPrimary: Colors.white,
      primaryContainer: CropColors.green100,
      onPrimaryContainer: CropColors.green900,
      secondary: CropColors.green600,
      onSecondary: Colors.white,
      secondaryContainer: CropColors.sage,
      onSecondaryContainer: CropColors.green900,
      tertiary: CropColors.amber500,
      onTertiary: CropColors.ink,
      error: CropColors.danger,
      onError: Colors.white,
      surface: CropColors.cream,
      onSurface: CropColors.ink,
      surfaceContainerLowest: Colors.white,
      surfaceContainerLow: Colors.white,
      surfaceContainer: Color(0xFFF1F0E9),
      surfaceContainerHigh: Color(0xFFECEBE3),
      onSurfaceVariant: CropColors.muted,
      outline: CropColors.border,
      outlineVariant: Color(0xFFEDEBE4),
    );

    final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: 'Manrope', scaffoldBackgroundColor: CropColors.cream);
    final text = base.textTheme.apply(bodyColor: CropColors.ink, displayColor: CropColors.ink);

    return base.copyWith(
      textTheme: text.copyWith(
        displaySmall: text.displaySmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -1.2, height: 1.05),
        headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.8, height: 1.1),
        headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5, height: 1.15),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.3),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        bodyLarge: text.bodyLarge?.copyWith(height: 1.45),
        bodyMedium: text.bodyMedium?.copyWith(height: 1.45),
        labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: 0.2),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: CropColors.cream,
        foregroundColor: CropColors.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: 'Manrope', fontSize: 20, fontWeight: FontWeight.w700, color: CropColors.ink, letterSpacing: -0.3),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CropRadii.card), side: const BorderSide(color: CropColors.border)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(64, CropSpace.touch),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CropRadii.button)),
          textStyle: const TextStyle(fontFamily: 'Manrope', fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, CropSpace.touch),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          foregroundColor: CropColors.green900,
          side: const BorderSide(color: CropColors.border),
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CropRadii.button)),
          textStyle: const TextStyle(fontFamily: 'Manrope', fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(48, 48),
          foregroundColor: CropColors.green800,
          textStyle: const TextStyle(fontFamily: 'Manrope', fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(CropRadii.button), borderSide: const BorderSide(color: CropColors.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(CropRadii.button), borderSide: const BorderSide(color: CropColors.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(CropRadii.button), borderSide: const BorderSide(color: CropColors.green600, width: 2)),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: Colors.white,
        selectedColor: CropColors.green800,
        side: const BorderSide(color: CropColors.border),
        shape: const StadiumBorder(),
        labelStyle: const TextStyle(fontFamily: 'Manrope', fontWeight: FontWeight.w600, color: CropColors.ink),
        secondaryLabelStyle: const TextStyle(fontFamily: 'Manrope', fontWeight: FontWeight.w600, color: Colors.white),
        checkmarkColor: Colors.white,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: CropColors.green100,
        surfaceTintColor: Colors.transparent,
        height: 72,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(fontFamily: 'Manrope', fontSize: 12, fontWeight: states.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: CropColors.green950,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CropRadii.button)),
      ),
      dividerTheme: const DividerThemeData(color: CropColors.border, space: 1),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
      }),
    );
  }
}
