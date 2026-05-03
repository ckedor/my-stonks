import { USER_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Cookies from 'js-cookie'

export async function initAuth(): Promise<void> {
  const token = Cookies.get('token')
  if (!token) {
    useAuthStore.getState().setUser(null)
    return
  }

  try {
    const { data } = await api.get(USER_ROUTES.me)
    useAuthStore.getState().setUser({ email: data.email, is_admin: data.is_admin || false })
  } catch {
    useAuthStore.getState().setUser(null)
  }
}

export async function login(token: string): Promise<void> {
  Cookies.set('token', token)
  api.defaults.headers.common.Authorization = `Bearer ${token}`
  try {
    const { data } = await api.get(USER_ROUTES.me)
    useAuthStore.getState().setUser({ email: data.email, is_admin: data.is_admin || false })
  } catch {
    useAuthStore.getState().setUser(null)
    throw new Error('Erro ao buscar usuário')
  }
}

export function logout(): void {
  Cookies.remove('token')
  delete api.defaults.headers.common.Authorization
  useAuthStore.getState().reset()
}
