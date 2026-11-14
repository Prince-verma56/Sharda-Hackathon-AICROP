import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:image_picker/image_picker.dart';

enum PhotoProblem { unreadable, unsupportedFormat, tooLarge, tooSmall }

class PhotoException implements Exception {
  const PhotoException(this.problem);
  final PhotoProblem problem;
}

class PickedPhoto {
  const PickedPhoto({required this.bytes, required this.filename, required this.mimeType, required this.width, required this.height, required this.source});
  final Uint8List bytes;
  final String filename;
  final String mimeType;
  final int width;
  final int height;
  /// camera | gallery | sample
  final String source;
}

/// Photo capture + validation. Resizing matches the web client (lib/cropai/shrink-photo.ts):
/// long edge ≤ 1600 px, JPEG quality 90 — far above what the classifier needs, light on rural
/// data. The server decodes and validates the bytes again; the model's own preprocessing is
/// untouched.
class PhotoService {
  PhotoService([ImagePicker? picker]) : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;

  static const maxBytes = 8 * 1024 * 1024; // same limit as the API (MAX_IMAGE_BYTES)
  static const minEdge = 128;
  static const maxEdge = 1600.0;
  static const jpegQuality = 90;

  Future<PickedPhoto?> pick({required bool camera}) async {
    final file = await _picker.pickImage(
      source: camera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: maxEdge,
      maxHeight: maxEdge,
      imageQuality: jpegQuality,
      requestFullMetadata: false, // no EXIF location is needed or kept
      preferredCameraDevice: CameraDevice.rear,
    );
    if (file == null) return null;
    return validate(await file.readAsBytes(), filename: file.name, source: camera ? 'camera' : 'gallery');
  }

  /// Format from magic bytes (not the file name), size and decodable dimensions.
  static Future<PickedPhoto> validate(Uint8List bytes, {required String filename, required String source}) async {
    if (bytes.isEmpty) throw const PhotoException(PhotoProblem.unreadable);
    if (bytes.length > maxBytes) throw const PhotoException(PhotoProblem.tooLarge);
    final mime = sniffImageType(bytes);
    if (mime == null) throw const PhotoException(PhotoProblem.unsupportedFormat);
    final (width, height) = await _dimensions(bytes);
    if (width < minEdge || height < minEdge) throw const PhotoException(PhotoProblem.tooSmall);
    final ext = switch (mime) { 'image/png' => 'png', 'image/webp' => 'webp', _ => 'jpg' };
    final base = filename.contains('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
    return PickedPhoto(bytes: bytes, filename: '${base.isEmpty ? 'leaf' : base}.$ext', mimeType: mime, width: width, height: height, source: source);
  }

  static String? sniffImageType(Uint8List b) {
    if (b.length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return 'image/jpeg';
    if (b.length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return 'image/png';
    if (b.length >= 12 && b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46 && b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50) {
      return 'image/webp';
    }
    return null;
  }

  static Future<(int, int)> _dimensions(Uint8List bytes) async {
    try {
      final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
      final descriptor = await ui.ImageDescriptor.encoded(buffer);
      final size = (descriptor.width, descriptor.height);
      descriptor.dispose();
      buffer.dispose();
      return size;
    } catch (_) {
      throw const PhotoException(PhotoProblem.unreadable);
    }
  }
}
