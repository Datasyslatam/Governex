import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_KEY!,
    secretAccessKey: process.env.R2_SECRET!,
  },
})

const SIGNED_URL_TTL_SECONDS = 5 * 60 // 5 minutos: suficiente para cargar la página, corto si se filtra el link

/**
 * Construye la key de almacenamiento para un archivo nuevo, siempre bajo el
 * tenant que lo sube. Todo archivo de Governex vive en R2 bajo `{tenantId}/...`.
 */
export function buildObjectKey(tenantId: number, originalName: string): string {
  const safeName = originalName.replace(/[^\w.\-]/g, '_')
  return `${tenantId}/${Date.now()}-${safeName}`
}

/**
 * Valida que una key pertenezca al tenant dado. Toda key de Governex tiene
 * el tenant_id como primer segmento de path (ver buildObjectKey). Si la key
 * no matchea, se trata como "no encontrado" — nunca se firma una URL fuera
 * del tenant del usuario, sin importar qué id/url haya llegado del body.
 */
export function keyBelongsToTenant(key: string, tenantId: number): boolean {
  return key.startsWith(`${tenantId}/`)
}

/**
 * Genera una URL de descarga firmada y de corta duración para una key que
 * ya se validó que pertenece al tenant del usuario autenticado.
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_TTL_SECONDS })
}

/**
 * Punto único de subida: usado por /api/uploads. Devuelve la key (no una
 * URL pública) — la URL de descarga se firma bajo demanda cada vez que el
 * frontend necesite mostrar/descargar el archivo, vía resolveFileUrl().
 */
export async function uploadObject(tenantId: number, originalName: string, mimeType: string, buffer: Buffer) {
  const key = buildObjectKey(tenantId, originalName)
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }))
  return key
}

/**
 * Convierte una key almacenada en BD en una URL firmada temporal, SOLO si
 * pertenece al tenant del usuario. Si la key es null/vacía, o no pertenece
 * al tenant, devuelve null en vez de lanzar — para no romper un listado
 * completo por un solo registro inconsistente.
 */
export async function resolveFileUrl(key: string | null | undefined, tenantId: number): Promise<string | null> {
  if (!key) return null
  if (!keyBelongsToTenant(key, tenantId)) {
    console.warn(`[storage] key fuera de tenant ignorada: ${key} (tenant ${tenantId})`)
    return null
  }
  try {
    return await getSignedDownloadUrl(key)
  } catch (err) {
    console.error('[storage] error firmando URL:', err)
    return null
  }
}
