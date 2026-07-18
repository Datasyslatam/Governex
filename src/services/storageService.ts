import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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
 * Construye la key de almacenamiento para un archivo nuevo, bajo una carpeta descriptiva
 * del tenant, e identifica quién cargó el archivo (usuario y rol).
 * Soporta retrocompatibilidad mediante el chequeo de prefijos.
 */
export function buildObjectKey(
  tenantId: number,
  tenantNombre: string,
  userNombre: string,
  userRole: string,
  originalName: string
): string {
  const safeTenantName = tenantNombre.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/(^_|_$)/g, '')
  const safeUserName = userNombre.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/(^_|_$)/g, '')
  const safeUserRole = userRole.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/(^_|_$)/g, '')
  const safeFileName = originalName.replace(/[^\w.\-]/g, '_')
  
  return `tenants/${tenantId}_${safeTenantName}/${Date.now()}_[${safeUserName}_${safeUserRole}]_${safeFileName}`
}

/**
 * Valida que una key pertenezca al tenant dado.
 * Soporta tanto el formato heredado `{tenantId}/` como el nuevo organizado `tenants/{tenantId}_...`
 */
export function keyBelongsToTenant(key: string, tenantId: number): boolean {
  return key.startsWith(`${tenantId}/`) || key.startsWith(`tenants/${tenantId}_`)
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
 * URL pública) con la metadata del tenant y del usuario cargador.
 */
export async function uploadObject(
  tenantId: number,
  tenantNombre: string,
  userNombre: string,
  userRole: string,
  originalName: string,
  mimeType: string,
  buffer: Buffer
) {
  const key = buildObjectKey(tenantId, tenantNombre, userNombre, userRole, originalName)
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
  let cleanKey = key
  if (cleanKey.startsWith('/api/uploads/view/')) {
    cleanKey = cleanKey.slice('/api/uploads/view/'.length)
  }
  if (!keyBelongsToTenant(cleanKey, tenantId)) {
    console.warn(`[storage] key fuera de tenant ignorada: ${cleanKey} (tenant ${tenantId})`)
    return null
  }
  try {
    return await getSignedDownloadUrl(cleanKey)
  } catch (err) {
    console.error('[storage] error firmando URL:', err)
    return null
  }
}

/**
 * Elimina un objeto de R2 a partir de su key.
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    }))
  } catch (err) {
    console.error(`Error al eliminar objeto con key ${key} de R2:`, err)
  }
}
