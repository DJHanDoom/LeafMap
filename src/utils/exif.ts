import * as exifr from 'exifr'
import type { LatLng } from '../types'

// Retorna lat/lng via EXIF (se existir)
export async function extractGpsFromFile(file: File): Promise<LatLng | null> {
  try {
    // exifr.gps aceita File/Blob diretamente
    const gps = await exifr.gps(file)
    if (!gps) return null
    const { latitude, longitude } = gps as { latitude?: number; longitude?: number }
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return { lat: latitude, lng: longitude }
    }
    return null
  } catch {
    return null
  }
}

// Tenta obter a data/hora da foto (DateTimeOriginal → CreateDate → ModifyDate)
export async function extractDateFromFile(file: File): Promise<Date | null> {
  try {
    const exif = await exifr.parse(file)
    const dto = (exif as any)?.DateTimeOriginal || (exif as any)?.CreateDate || (exif as any)?.ModifyDate
    if (dto instanceof Date) return dto
    return null
  } catch {
    return null
  }
}
