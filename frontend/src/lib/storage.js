import { uploadPresigned } from '@vercel/blob/client'
import api, { API_BASE_URL } from './api'

const TOKEN_KEY = 'fixly_token'
const USER_KEY = 'fixly_user'
const useBlobStorage = import.meta.env.VITE_STORAGE_DRIVER === 'blob'
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function validateImage(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Please choose a JPEG, PNG, or WebP image')
  }
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Image must be 5 MB or smaller')
}

function session() {
  const token = localStorage.getItem(TOKEN_KEY)
  let user
  try {
    user = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    user = null
  }
  if (!token || !user?.id) throw new Error('Please sign in again before uploading')
  return { token, user }
}

function safeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+/, '') || 'image.jpg'
}

async function uploadBlob(file, { kind, jobId }) {
  validateImage(file)
  const { token, user } = session()
  const result = await uploadPresigned(`fixly/${kind}/${user.id}/${safeFilename(file.name)}`, file, {
    access: kind === 'nic' ? 'private' : 'public',
    handleUploadUrl: `${API_BASE_URL}/uploads/token`,
    headers: { Authorization: `Bearer ${token}` },
    clientPayload: JSON.stringify({ kind, jobId: jobId || null }),
    contentType: file.type,
  })
  return { url: result.url, pathname: result.pathname }
}

export async function uploadSingleImage({ file, kind, endpoint, fieldName }) {
  validateImage(file)
  if (useBlobStorage) {
    const blob = await uploadBlob(file, { kind })
    return api.post(endpoint, blob)
  }
  const form = new FormData()
  form.append(fieldName, file)
  return api.post(endpoint, form)
}

export async function uploadJobImages(files, jobId) {
  files.forEach(validateImage)
  if (useBlobStorage) {
    const photos = await Promise.all(files.map(file => uploadBlob(file, { kind: 'job', jobId })))
    return api.post(`/jobs/${jobId}/photos`, { photos })
  }
  const form = new FormData()
  files.forEach(file => form.append('photos', file))
  return api.post(`/jobs/${jobId}/photos`, form)
}
