export interface ClientPrincipal {
  identityProvider: string
  userId: string
  userDetails: string  // email address
  userRoles: string[]
}

export async function getUser(): Promise<ClientPrincipal | null> {
  try {
    const res = await fetch('/.auth/me')
    const { clientPrincipal } = await res.json()
    return clientPrincipal ?? null
  } catch {
    return null
  }
}

export function signIn() {
  window.location.href = '/.auth/login/aad'
}

export function signOut() {
  window.location.href = '/.auth/logout'
}
