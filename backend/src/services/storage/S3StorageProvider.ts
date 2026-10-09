import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { env } from "../../config/env";
import { FileObject, StorageProvider, UploadResult } from "./StorageProvider";

/**
 * Implementation S3-compatible du StorageProvider.
 * En developpement, cible une instance MinIO (docker-compose).
 * En production, il suffit de changer les variables d'environnement
 * (endpoint, credentials, bucket) pour pointer vers un vrai bucket S3.
 */
export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.storage.bucket;
    this.client = new S3Client({
      endpoint: env.storage.endpoint,
      region: env.storage.region,
      forcePathStyle: env.storage.forcePathStyle,
      // Les versions recentes du SDK ajoutent par defaut une somme de controle
      // a chaque requete, que certains stockages compatibles S3 (hors AWS) ne
      // gerent pas tous. On ne l'envoie que lorsque l'operation l'exige.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: env.storage.accessKeyId,
        secretAccessKey: env.storage.secretAccessKey,
      },
    });
  }

  async upload(params: {
    buffer: Buffer;
    key: string;
    contentType: string;
  }): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      })
    );

    return {
      key: params.key,
      size: params.buffer.length,
      contentType: params.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  /**
   * Lit le fichier depuis MinIO/S3 et renvoie le flux, sans le mettre en
   * memoire : GetObjectCommand rend deja un flux node, que l'on branche tel
   * quel sur la reponse Express (`stream.pipe(res)`). Un PDF de 20 Mo ne
   * consomme donc pas 20 Mo sur le heap du serveur.
   *
   * Si la cle n'existe pas, S3 repond NoSuchKey : c'est le cas d'une fiche
   * dont le fichier a ete supprime du bucket, mais dont l'enregistrement en
   * base existe toujours. Le controller traduit l'erreur en 404 (voir
   * error handler).
   */
  async getObjectStream(key: string): Promise<FileObject> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );

    return {
      stream: result.Body as Readable,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  }
}

export const storageProvider = new S3StorageProvider();
