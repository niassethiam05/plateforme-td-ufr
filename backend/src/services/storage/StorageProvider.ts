export interface UploadResult {
  key: string;
  size: number;
  contentType: string;
}

/**
 * Abstraction du stockage de fichiers.
 * L'implementation par defaut (S3StorageProvider) cible un endpoint
 * S3-compatible (MinIO en developpement, S3/DigitalOcean Spaces/etc en prod).
 * Toute la logique metier doit dependre uniquement de cette interface,
 * jamais d'un SDK de stockage concret.
 *
 * Le bucket est prive par defaut (voir docker-compose.yml) : seule
 * getSignedUrl() doit servir a donner un acces temporaire a un fichier,
 * apres que le controller appelant a verifie le role/statut de la
 * ressource. Ne jamais exposer directement une cle ou une URL publique.
 */
export interface StorageProvider {
  upload(params: {
    buffer: Buffer;
    key: string;
    contentType: string;
  }): Promise<UploadResult>;

  delete(key: string): Promise<void>;

  /**
   * URL signee temporaire pour un acces controle (lecture/telechargement).
   * `downloadFileName`, si fourni, force le navigateur a telecharger le
   * fichier (Content-Disposition: attachment) plutot que l'afficher en
   * ligne — utilise pour le bouton "Telecharger" (vs "Consulter").
   */
  getSignedUrl(
    key: string,
    expiresInSeconds?: number,
    downloadFileName?: string
  ): Promise<string>;
}
