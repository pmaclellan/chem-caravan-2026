import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthStore {
  user: User | null
  session: Session | null
  isLoading: boolean
  error: string | null
  isPasswordRecovery: boolean

  initialize: () => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  clearError: () => void
  sendPasswordReset: (email: string) => Promise<boolean>
  updatePassword: (newPassword: string) => Promise<boolean>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  isPasswordRecovery: false,

  initialize: async () => {
    const { data } = await supabase.auth.getSession()
    set({ session: data.session, user: data.session?.user ?? null, isLoading: false })

    supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null })
      if (event === 'PASSWORD_RECOVERY') {
        set({ isPasswordRecovery: true })
      }
    })
  },

  signUp: async (email, password) => {
    set({ error: null, isLoading: true })
    const { error } = await supabase.auth.signUp({ email, password })
    set({ isLoading: false })
    if (error) { set({ error: error.message }); return false }
    return true
  },

  signIn: async (email, password) => {
    set({ error: null, isLoading: true })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    set({ isLoading: false })
    if (error) { set({ error: error.message }); return false }
    return true
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  clearError: () => set({ error: null }),

  sendPasswordReset: async (email) => {
    set({ error: null, isLoading: true })
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    set({ isLoading: false })
    if (error) { set({ error: error.message }); return false }
    return true
  },

  updatePassword: async (newPassword) => {
    set({ error: null, isLoading: true })
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    set({ isLoading: false })
    if (error) { set({ error: error.message }); return false }
    set({ isPasswordRecovery: false })
    return true
  },
}))
