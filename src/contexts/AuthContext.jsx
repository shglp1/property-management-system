import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    const fetchUserRole = async (currentUser) => {
      if (!currentUser) {
        setUserRole(null)
        return
      }

      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('role')
          .eq('email', currentUser.email)
          .single()

        if (error) {
          console.error('Error fetching user role:', error)
          setUserRole(null)
          return
        }

        setUserRole(data?.role || null)
      } catch (error) {
        console.error('Error fetching user role:', error)
        setUserRole(null)
      }
    }

    const setAuthData = async (session) => {
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        await fetchUserRole(currentUser)
      } else {
        setUserRole(null)
      }
      setLoading(false)
    }

    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthData(session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthData(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
    return data
  }

  const value = {
    user,
    userRole,
    session,
    loading,
    signIn,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
