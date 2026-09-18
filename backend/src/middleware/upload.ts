import multer from "multer";
import { env } from "../config/env";

const ALLOWED_PDF_TYPES = new Set(["application/pdf"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Upload en memoire (pas d'ecriture sur disque local) : le buffer est
 * ensuite transmis tel quel au StorageProvider (MinIO/S3). La verification
 * du type se fait sur le mimetype ET sur la signature reelle du fichier
 * (voir validators/fileSignature.ts) avant tout envoi au stockage.
 */
const storage = multer.memoryStorage();

export const uploadTdFile = multer({
  storage,
  limits: { fileSize: env.upload.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "file" && !ALLOWED_PDF_TYPES.has(file.mimetype)) {
      return cb(new Error("Le fichier de la fiche doit etre un PDF."));
    }
    if (file.fieldname === "coverImage" && !ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error("L'image de couverture doit etre au format PNG, JPEG ou WEBP."));
    }
    cb(null, true);
  },
}).fields([
  { name: "file", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);
