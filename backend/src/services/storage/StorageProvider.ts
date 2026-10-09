import type { Readable } from "stream";

export interface UploadResult {
  key: string;
  size: number;
  contentType: string;
}

/**
 * Flux renvoye par StorageProvider.getObjectStream.
 *
 * `stream` est un flux node entierement lisible, meme si la taille n'est pas
 * connue : les headers peuvent donc etre positionnes avant d'envoyer l'octet
 * le premier.
 */
export interface FileObject {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
}

/**
 * Abstraction du stockage de fichiers.
 * L'implementation par defaut (S3StorageProvider) cible un endpoint
 * S3-compatible (MinIO en developpement, S3/DigitalOcean Spaces/etc en prod).
 * Toute la logique metier doit dependre uniquement de cette interface,
 * jamais d'un SDK de stockage concret.
 *
 * Le bucket est prive par defaut (voir docker-compose.yml) : le serveur est le
 * seul a pouvoir le lire. Le flux est transmis par le backend lui-meme, apres
 * que le controller appelant a verifie le role et le statut de la ressource.
 *
 * Il n'y a volontairement PAS de methode "give a URL to the browser". Une URL
 * signee emportee hors du serveur : elle n'est plus du tout verifiee (le
 * navigateur la demande directement au stockage), elle ne suit donc ni la
 * relecture du compte (desactivation), ni le changement de statut de la fiche,
 * ni le cloisonnement par filiere — pendant toute sa duree de vie. Elle
 * embarque en plus un nom d'hote, ce qui impose de publier le stockage sous
 * une adresse accessible au navigateur (impossible quand MinIO vit dans un
 * reseau Docker prive). Streamer via le backend resout les deux problemes.
 */
export interface StorageProvider {
  upload(params: {
    buffer: Buffer;
    key: string;
    contentType: string;
  }): Promise<UploadResult>;

  delete(key: string): Promise<void>;

  getObjectStream(key: string): Promise<FileObject>;
}
