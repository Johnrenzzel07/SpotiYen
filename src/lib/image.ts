export async function prepareCoverBlob(file: File): Promise<Blob> {
  const looksLikeImage =
    file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
  if (!looksLikeImage) {
    throw new Error("Pick a photo (JPG, PNG, or WebP).");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("That photo is too large. Pick one under 12 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Could not read that photo. Try a JPG or PNG.");
  }

  const max = 900;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare that photo.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86)
  );
  if (!blob) throw new Error("Could not prepare that photo.");
  return blob;
}
