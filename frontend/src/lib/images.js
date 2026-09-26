// Prepares a photo for upload: converts iPhone HEIC photos to JPEG where the
// browser can decode them, and shrinks large images so uploads are quick on
// mobile data. The server accepts JPEG, PNG and WebP up to 5 MB.

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const HEIC = new Set(['image/heic', 'image/heif'])
const MAX_DIMENSION = 2000
const RESIZE_ABOVE_BYTES = 1.5 * 1024 * 1024
const MAX_BYTES = 5 * 1024 * 1024

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif'

function isHeic(file) {
  return HEIC.has(file.type) || /\.(heic|heif)$/i.test(file.name)
}

async function decode(file) {
  if (typeof createImageBitmap !== 'function') throw new Error('unsupported')
  return createImageBitmap(file)
}

async function toJpeg(bitmap, name) {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('encode failed')
  return new File([blob], name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

/**
 * Returns an upload-ready File, or throws an Error with a message that can be
 * shown to the user.
 */
export async function prepareImage(file) {
  if (isHeic(file)) {
    try {
      return await toJpeg(await decode(file), file.name)
    } catch {
      throw new Error(`“${file.name}” is an iPhone HEIC photo this browser can’t read. On your iPhone, choose Settings › Camera › Formats › Most Compatible, or send the photo as JPEG.`)
    }
  }
  if (!ACCEPTED.has(file.type)) {
    throw new Error(`“${file.name}” isn’t a supported image. Use a JPEG, PNG or WebP photo.`)
  }
  if (file.size <= RESIZE_ABOVE_BYTES) return file
  try {
    const bitmap = await decode(file)
    const resized = await toJpeg(bitmap, file.name)
    return resized.size < file.size ? resized : file
  } catch {
    if (file.size > MAX_BYTES) throw new Error(`“${file.name}” is larger than 5 MB. Choose a smaller photo.`)
    return file
  }
}
