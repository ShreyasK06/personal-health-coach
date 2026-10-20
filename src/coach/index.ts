// Coach entry point: picks the HTTP adapter when VITE_COACH_ENDPOINT is set
// (a server the user runs, which holds any API key), else the offline rules
// coach. No API key is read or embedded in client code.
import type { CoachAdapter } from './adapter'
import { rulesAdapter } from './rulesAdapter'
import { createHttpAdapter } from './httpAdapter'

export type { CoachAdapter, CoachContext } from './adapter'
export { buildCoachContext } from './adapter'

export function getCoach(): CoachAdapter {
  const endpoint = import.meta.env.VITE_COACH_ENDPOINT as string | undefined
  return endpoint ? createHttpAdapter(endpoint, rulesAdapter) : rulesAdapter
}
