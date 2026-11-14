/**
 * Shrinks a large phone photo before upload (browser only): long edge ≤ 1600 px, JPEG q0.9 — what
 * the server stores anyway, far above what the classifier needs, and it keeps uploads well under
 * serverless request limits (~4.5 MB) and light on rural mobile data. Small photos are sent as-is.
 */
export async function shrinkPhoto(file: File, maxEdge = 1600, quality = 0.9): Promise<File> {
  if (typeof createImageBitmap !== 'function' || file.size <= 1_500_000) return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
