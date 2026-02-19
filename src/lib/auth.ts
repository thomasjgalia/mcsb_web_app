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
  // After clearing the SWA session, redirect to AAD login with account picker
  // so the user explicitly chooses their account rather than being silently re-authed
  const loginWithPicker = encodeURIComponent('/.auth/login/aad?prompt=select_account')
  window.location.href = `/.auth/logout?post_logout_redirect_uri=${loginWithPicker}`
}
