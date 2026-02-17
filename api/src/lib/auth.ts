import { HttpRequest } from '@azure/functions'

export interface ClientPrincipal {
  identityProvider: string
  userId: string
  userDetails: string  // email address
  userRoles: string[]
}

export function getClientPrincipal(req: HttpRequest): ClientPrincipal | null {
  const header = req.headers.get('x-ms-client-principal')
  if (!header) return null
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf-8')) as ClientPrincipal
  } catch {
    return null
  }
}

export function requireAuth(req: HttpRequest): ClientPrincipal {
  const principal = getClientPrincipal(req)
  if (!principal || !principal.userRoles?.includes('authenticated')) {
    throw new Error('Unauthorized')
  }
  return principal
}
