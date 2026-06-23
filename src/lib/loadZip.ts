import { unzipSync, strFromU8 } from 'fflate'

export interface ExportCsvs {
  dailyCsv: string | null
  workoutsCsv: string | null
}

export function extractCsvs(zip: Uint8Array): ExportCsvs {
  const files = unzipSync(zip)
  let dailyCsv: string | null = null,
    workoutsCsv: string | null = null
  for (const [name, bytes] of Object.entries(files)) {
    if (name.includes('HealthAutoExport-')) dailyCsv = strFromU8(bytes)
    else if (name.split('/').pop()!.startsWith('Workouts')) workoutsCsv = strFromU8(bytes)
  }
  return { dailyCsv, workoutsCsv }
}
