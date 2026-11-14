import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers.dart';

/// Opens official sites / phone numbers outside the app. Only http(s) and tel: are allowed.
Future<bool> openExternal(Uri uri) async {
  if (!{'https', 'http', 'tel', 'mailto'}.contains(uri.scheme)) return false;
  try {
    return await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}

/// A text button that opens a page of the CropAI website (privacy policy, terms, data rights).
class WebLinkButton extends ConsumerWidget {
  const WebLinkButton({super.key, required this.label, required this.path});
  final String label;
  final String path;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextButton(
      style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4)),
      onPressed: () => openExternal(ref.read(apiClientProvider).resolve(path)),
      child: Text(label),
    );
  }
}
