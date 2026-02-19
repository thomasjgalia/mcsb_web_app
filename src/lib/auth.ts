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
  window.location.href = '/.auth/login/aad?prompt=select_account'
}

export function signOut() {
  // Return to app root after logout — the app will show the login screen
  window.location.href = '/.auth/logout?post_logout_redirect_uri=/'
}
