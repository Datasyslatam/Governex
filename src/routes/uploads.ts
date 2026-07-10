import { Router, Response } from 'express'
import multer from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { ACCEPTED_MIME_TYPES } from '../constants/uploads'

const router = Router()
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

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_KEY!,
    secretAccessKey: process.env.R2_SECRET!,
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
        url: `${process.env.R2_PUBLIC_URL}/${key}`,
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