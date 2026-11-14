import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/assistant/presentation/assistant_screen.dart';
import '../../features/assistant/presentation/mitra_settings_screen.dart';
import '../../features/authentication/application/auth_controller.dart';
import '../../features/authentication/data/auth_models.dart';
import '../../features/authentication/presentation/login_screen.dart';
import '../../features/authentication/presentation/otp_screen.dart';
import '../../features/authentication/presentation/splash_screen.dart';
import '../../features/camera/presentation/review_screen.dart';
import '../../features/camera/presentation/scan_screen.dart';
import '../../features/crops/presentation/crop_picker_screen.dart';
import '../../features/diagnosis/presentation/report_screen.dart';
import '../../features/government_resources/presentation/resources_screen.dart';
import '../../features/home/presentation/farmer_shell.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/reports/presentation/history_screen.dart';
import '../../features/volunteer/presentation/volunteer_screen.dart';

/// Route names used across the app (one place, no string typos in screens).
abstract final class Routes {
  static const splash = '/splash';
  static const login = '/login';
  static const verifyOtp = '/verify-otp';
  static const onboarding = '/onboarding';
  static const home = '/farmer/home';
  static const crops = '/farmer/crops';
  static const scan = '/farmer/scan';
  static const scanReview = '/farmer/scan/review';
  static const history = '/farmer/history';
  static const assistant = '/farmer/assistant';
  static const profile = '/farmer/profile';
  static const settings = '/farmer/settings';
  static const resources = '/farmer/resources';
  static const notifications = '/farmer/notifications';
  static const volunteer = '/volunteer';
  static const noWorkspace = '/no-workspace';
  static String diagnosis(String id) => '/farmer/diagnosis/$id';
  static String assistantWith({String? diagnosisId, String? question, bool voice = false, String? conversationId, bool fresh = false}) =>
      Uri(path: assistant, queryParameters: {
        'diagnosisId': ?diagnosisId,
        'q': ?question,
        if (voice) 'voice': '1',
        'conversationId': ?conversationId,
        if (fresh) 'new': '1',
      }).toString();
}

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// Pure redirect rule (unit-tested): where a user in [auth] state may be at [location].
String? redirectFor(AuthState auth, String location) {
  final atAuthScreen = location == Routes.login || location == Routes.verifyOtp;
  switch (auth) {
    case AuthUnknown():
      return location == Routes.splash ? null : Routes.splash;
    case AuthSignedOut():
      return atAuthScreen ? null : Routes.login;
    case AuthSignedIn(:final me):
      if (!me.isFarmer) {
        if (me.hasVolunteerWorkspace) return location.startsWith(Routes.volunteer) ? null : Routes.volunteer;
        return location == Routes.noWorkspace ? null : Routes.noWorkspace;
      }
      final needsOnboarding = (auth).needsOnboarding;
      if (needsOnboarding) return location == Routes.onboarding ? null : Routes.onboarding;
      if (location == Routes.splash || atAuthScreen || location == Routes.onboarding || location == Routes.noWorkspace) return Routes.home;
      if (location.startsWith(Routes.volunteer) && !me.hasVolunteerWorkspace) return Routes.home;
      return null;
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen<AuthState>(authControllerProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) => redirectFor(ref.read(authControllerProvider), state.matchedLocation),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.login, builder: (_, _) => const LoginScreen()),
      GoRoute(
        path: Routes.verifyOtp,
        redirect: (_, state) => state.extra is OtpChallenge ? null : Routes.login,
        builder: (_, state) => OtpScreen(challenge: state.extra! as OtpChallenge),
      ),
      GoRoute(path: Routes.onboarding, builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: Routes.noWorkspace, builder: (_, _) => const NoWorkspaceScreen()),
      GoRoute(path: Routes.volunteer, builder: (_, _) => const VolunteerScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => FarmerShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Routes.home, builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.history, builder: (_, _) => const HistoryScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.assistant,
              builder: (_, state) {
                final q = state.uri.queryParameters;
                return AssistantScreen(
                  key: ValueKey(state.uri.toString()),
                  diagnosisId: q['diagnosisId'],
                  initialQuestion: q['q'],
                  autoVoice: q['voice'] == '1',
                  conversationId: q['conversationId'],
                  fresh: q['new'] == '1',
                );
              },
            ),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.profile, builder: (_, _) => const ProfileScreen())]),
        ],
      ),
      GoRoute(parentNavigatorKey: _rootKey, path: Routes.crops, builder: (_, _) => const CropPickerScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: Routes.scan, builder: (_, _) => const ScanScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: Routes.scanReview, builder: (_, _) => const ReviewScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/farmer/diagnosis/:id', builder: (_, state) => ReportScreen(id: state.pathParameters['id']!)),
      GoRoute(parentNavigatorKey: _rootKey, path: '/farmer/history/:id', builder: (_, state) => ReportScreen(id: state.pathParameters['id']!)),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: Routes.resources,
        builder: (_, state) => ResourcesScreen(initialTab: state.extra is ResourcesTab ? state.extra! as ResourcesTab : ResourcesTab.government),
      ),
      GoRoute(parentNavigatorKey: _rootKey, path: Routes.settings, builder: (_, _) => const MitraSettingsScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: Routes.notifications, builder: (_, _) => const NotificationsScreen()),
    ],
  );
});
