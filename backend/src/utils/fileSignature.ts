/**
 * Verifie la signature binaire reelle d'un fichier (magic bytes), en plus
 * du mimetype declare par le client (qui peut etre falsifie). Empeche
 * qu'un fichier renomme en .pdf mais contenant autre chose soit accepte.
 */
export function isPdfBuffer(buffer: Buffer): boolean {
  // Un PDF commence toujours par "%PDF-" (0x25 0x50 0x44 0x46 0x2D)
  return (
    buffer.length > 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

export function isImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // PNG: 89 50 4E 47
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // WEBP: "RIFF"...."WEBP"
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  return isPng || isJpeg || isWebp;
}
