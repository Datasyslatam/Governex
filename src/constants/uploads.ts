// src/constants/uploads.ts

export const ACCEPTED_MIME_TYPES = [
  // Imágenes
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Comprimidos
  'application/zip',
  'application/x-zip-compressed',
] as const

export const ACCEPTED = ACCEPTED_MIME_TYPES.join(',')