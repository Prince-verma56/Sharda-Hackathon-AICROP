import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// true = some network interface is up. (A network does not guarantee the CropAI server is
/// reachable — requests still report offline/timeout errors precisely.)
final connectivityProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  bool online(List<ConnectivityResult> r) => r.any((c) => c != ConnectivityResult.none);
  yield online(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(online).distinct();
});

/// Synchronous view for widgets: assume online until the platform says otherwise.
final isOnlineProvider = Provider<bool>((ref) => ref.watch(connectivityProvider).value ?? true);
