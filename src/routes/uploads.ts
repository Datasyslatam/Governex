import { Router, Response } from 'express'
import multer from 'multer'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { ACCEPTED_MIME_TYPES } from '../constants/uploads'

const router = Router()

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || process.env.R2_ENDPOINT0,
  credentials: {
    accessKeyId: process.env.R2_KEY!,
    secretAccessKey: process.env.R2_SECRET!,
  },
})

// Endpoint público (sin authMiddleware) para ver archivos
router.get('/view/:key', async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: req.params.key,
    })
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
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
      const safeName = req.file.originalname.replace(/[^\w.\-]/g, '_')
      const key = `${Date.now()}-${safeName}`
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }))
      res.json({
        url: `/api/uploads/view/${key}`,
        key,
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

export default router