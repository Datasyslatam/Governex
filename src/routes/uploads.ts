import { Router, Response } from 'express'
import multer from 'multer'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { ACCEPTED_MIME_TYPES } from '../constants/uploads'
import { uploadObject, resolveFileUrl, keyBelongsToTenant, getSignedDownloadUrl } from '../services/storageService'
import { pool } from '../db'

const router = Router()

// Endpoint público (sin authMiddleware) para compatibilidad hacia atrás
// con URLs antiguas de R2 y con el RequerimientosPSPage actual.
router.get('/view/:key(*)', async (req, res) => {
  try {
    const url = await getSignedDownloadUrl(req.params.key)
    res.redirect(url)
  } catch (err) {
    res.status(500).send('Error al generar el enlace de visualización')
  }
})

router.use(authMiddleware)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ACCEPTED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de archivo no permitido'))
    }
  },
})

// POST /api/uploads
// Sube el archivo a R2 bajo `{tenantId}/...` y devuelve la KEY (no una URL
// pública permanente). El frontend guarda esa key en el campo correspondiente
// (archivo_url, url, organigrama_url, etc. — el nombre de columna no cambió,
// pero desde ahora su contenido es una key de R2, no una URL pública) y pide
// una URL de descarga firmada bajo demanda vía GET /api/uploads/signed-url.
router.post('/', (req: AuthRequest, res: Response) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido (20 MB)' })
      }
      return res.status(400).json({ error: 'Error al procesar el archivo' })
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'Tipo de archivo no permitido' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' })
    }

    try {
      const tenantId = req.user!.tenantId
      const userId = req.user!.id
      const userRole = req.user!.rol

      const [tenantRes, userRes] = await Promise.all([
        pool.query('SELECT nombre FROM tenants WHERE id = $1', [tenantId]),
        pool.query('SELECT nombre FROM usuarios WHERE id = $1', [userId])
      ])

      const tenantNombre = tenantRes.rows[0]?.nombre || `tenant_${tenantId}`
      const userNombre = userRes.rows[0]?.nombre || `usuario_${userId}`

      const key = await uploadObject(
        tenantId,
        tenantNombre,
        userId,
        userNombre,
        userRole,
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer
      )
      // Se firma una primera URL de cortesía para que el frontend pueda
      // mostrar/previsualizar el archivo inmediatamente tras subirlo, sin
      // tener que hacer una segunda llamada. Para verlo más adelante
      // (recargar la página, etc.) hay que pedir una nueva vía signed-url.
      const url = `/api/uploads/view/${key}` // proxy de compatibilidad
      res.json({
        key,
        url,
        nombre: req.file.originalname,
        tipoMime: req.file.mimetype,
        tamanoBytes: req.file.size,
      })
    } catch (uploadErr) {
      console.error(uploadErr)
      res.status(500).json({ error: 'Error al subir archivo' })
    }
  })
})

// GET /api/uploads/signed-url?key=...
// Renueva la URL de descarga de una key ya subida. Valida que la key
// pertenezca al tenant del usuario ANTES de firmar — nunca confía en el
// key recibido por query string sin verificarlo primero.
router.get('/signed-url', async (req: AuthRequest, res: Response) => {
  const key = req.query.key as string | undefined
  if (!key) return res.status(400).json({ error: 'Se requiere el parámetro key' })

  const tenantId = req.user!.tenantId
  if (!keyBelongsToTenant(key, tenantId)) {
    // 404 en vez de 403: no confirmamos ni siquiera que la key exista en
    // otro tenant, para no dar información útil a un intento de enumeración.
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }

  try {
    const url = await resolveFileUrl(key, tenantId)
    if (!url) return res.status(404).json({ error: 'Archivo no encontrado' })
    res.json({ url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al generar la URL de descarga' })
  }
})

export default router
