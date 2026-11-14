import 'package:material_ui/material_ui.dart';
import 'package:permission_handler/permission_handler.dart';

import '../localization/generated/app_localizations.dart';
import '../theme/app_theme.dart';

enum PermissionOutcome { granted, denied, permanentlyDenied }

/// Explains WHY before the system dialog, asks only when the feature is used, and sends the
/// farmer to settings when the permission was turned off permanently.
abstract final class PermissionService {
  static Future<PermissionOutcome> ensure(
    BuildContext context, {
    required Permission permission,
    required String title,
    required String body,
    required IconData icon,
  }) async {
    var status = await permission.status;
    if (status.isGranted || status.isLimited) return PermissionOutcome.granted;
    if (!context.mounted) return PermissionOutcome.denied;

    if (status.isPermanentlyDenied) {
      await _settingsDialog(context, title);
      return PermissionOutcome.permanentlyDenied;
    }
    final proceed = await _rationale(context, title: title, body: body, icon: icon);
    if (!proceed) return PermissionOutcome.denied;
    status = await permission.request();
    if (status.isGranted || status.isLimited) return PermissionOutcome.granted;
    if (status.isPermanentlyDenied && context.mounted) {
      await _settingsDialog(context, title);
      return PermissionOutcome.permanentlyDenied;
    }
    return PermissionOutcome.denied;
  }

  static Future<bool> _rationale(BuildContext context, {required String title, required String body, required IconData icon}) async {
    final l = AppLocalizations.of(context);
    final result = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(color: CropColors.green100, borderRadius: BorderRadius.circular(18)),
              child: Icon(icon, color: CropColors.green800, size: 28),
            ),
            const SizedBox(height: 16),
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(body, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 22),
            Row(children: [
              Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context, false), child: Text(l.cancel))),
              const SizedBox(width: 12),
              Expanded(child: FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(l.continueLabel))),
            ]),
          ]),
        ),
      ),
    );
    return result ?? false;
  }

  static Future<void> _settingsDialog(BuildContext context, String title) async {
    final l = AppLocalizations.of(context);
    final open = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(l.permissionDeniedForever),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(l.openSettings)),
        ],
      ),
    );
    if (open == true) await openAppSettings();
  }
}
