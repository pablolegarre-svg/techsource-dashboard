import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { supabase } from './supabase'

import PublicNavbar from './components/PublicNavbar'
import AdminNavbar from './components/AdminNavbar'
import ChatWidget from './components/ChatWidget'
import AdminBot from './components/AdminBot'

import LoginCliente from './pages/LoginCliente'
import LoginAdmin from './pages/LoginAdmin'
import Footer from './components/Footer'
import Dashboard from './pages/Dashboard'
import Catalogo from './pages/Catalogo'
import CatalogoPublico from './pages/CatalogoPublico'
import Historial from './pages/Historial'
import Cotizaciones from './pages/Cotizaciones'
import MisCotizaciones from './pages/MisCotizaciones'
import Cotizar from './pages/Cotizar'
import Clientes from './pages/Clientes'
import Proveedores from './pages/Proveedores'

// ─── Layouts ────────────────────────────────────────────────────────────────

function PublicLayout({ session, clienteSession, adminVerificado, onClienteLogout }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="bg-illustration" />
      <PublicNavbar
        session={session}
        admin={adminVerificado}
        clienteSession={clienteSession}
        onClienteLogout={onClienteLogout}
      />
      <div style={{ flex: 1 }}>
        <Outlet context={{ session, clienteSession }} />
      </div>
      <Footer />
      <ChatWidget clienteSession={clienteSession} />
    </div>
  )
}

function AdminLayout({ session }) {
  return (
    <div className="admin-shell">
      <AdminNavbar />
      <div className="admin-content">
        <Outlet context={{ session }} />
      </div>
      <AdminBot />
    </div>
  )
}

// ─── Guards ─────────────────────────────────────────────────────────────────

function RequireCliente({ clienteSession, children }) {
  if (!clienteSession) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ session, adminVerificado, children }) {
  if (session === undefined || adminVerificado === undefined) return null  // cargando
  if (!session || !adminVerificado) return <Navigate to="/ts-panel/auth" replace />
  return children
}

// ─── App ────────────────────────────────────────────────────────────────────

function loadClienteSession() {
  try { return JSON.parse(sessionStorage.getItem('ts_cliente')) ?? null }
  catch { return null }
}

export default function App() {
  const [session, setSession]               = useState(undefined)
  const [adminVerificado, setAdminVerificado] = useState(undefined)
  const [clienteSession, setClienteSession] = useState(loadClienteSession)
  const [sessionExpirada, setSessionExpirada] = useState(false)
  const [sessionCerrada, setSessionCerrada]   = useState(false)

  // Consulta la tabla user_roles para saber si el usuario es admin
  async function checkAdminRole(userId) {
    if (!userId) { setAdminVerificado(false); return }
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()
    setAdminVerificado(!!data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      const s = data.session ?? null
      setSession(s)
      if (s) {
        checkAdminRole(s.user.id)
      } else {
        setAdminVerificado(false)
        if (error) {
          setSessionExpirada(true)
          setTimeout(() => setSessionExpirada(false), 5000)
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      const s = newSession ?? null
      setSession(s)
      if (s) {
        checkAdminRole(s.user.id)
      } else {
        setAdminVerificado(false)
        if (event === 'SIGNED_OUT') {
          setSessionCerrada(true)
          setTimeout(() => setSessionCerrada(false), 3000)
        } else if (event === 'TOKEN_REFRESHED') {
          setSessionExpirada(true)
          setTimeout(() => setSessionExpirada(false), 5000)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Cuando se confirma que es admin, limpiar clienteSession si existiera
  useEffect(() => {
    if (adminVerificado) {
      sessionStorage.removeItem('ts_cliente')
      setClienteSession(null)
    }
  }, [adminVerificado])

  function handleClienteLogin(cliente) {
    sessionStorage.setItem('ts_cliente', JSON.stringify(cliente))
    setClienteSession(cliente)
  }

  function handleClienteLogout() {
    sessionStorage.removeItem('ts_cliente')
    setClienteSession(null)
    setSessionCerrada(true)
    setTimeout(() => setSessionCerrada(false), 3000)
  }

  // Login solo se bloquea si ya hay sesión admin confirmada
  const loginBloqueado = session && adminVerificado

  return (
    <>
    {(sessionExpirada || sessionCerrada) && (
      <div className="session-cerrada-overlay">
        <div className="session-cerrada-card">
          <span className="session-cerrada-icon" style={sessionExpirada ? { background: '#fde2e1', color: '#b42318' } : {}}>
            {sessionExpirada ? '🔒' : '✓'}
          </span>
          <p className="session-cerrada-titulo">
            {sessionExpirada ? 'Sesión expirada' : 'Sesión cerrada'}
          </p>
          <p className="session-cerrada-sub">
            {sessionExpirada ? 'Iniciá sesión nuevamente.' : 'Hasta luego.'}
          </p>
        </div>
      </div>
    )}
    <Routes>
      {/* Raíz */}
      <Route path="/" element={<Navigate to="/catalogo" replace />} />

      {/* Login cliente */}
      <Route
        path="/login"
        element={
          loginBloqueado
            ? <Navigate to="/dashboard" replace />
            : <LoginCliente onClienteLogin={handleClienteLogin} />
        }
      />

      {/* Login admin */}
      <Route
        path="/ts-panel/auth"
        element={
          loginBloqueado
            ? <Navigate to="/dashboard" replace />
            : <LoginAdmin />
        }
      />

      {/* Zona Pública */}
      <Route element={
        <PublicLayout
          session={session}
          clienteSession={clienteSession}
          adminVerificado={adminVerificado}
          onClienteLogout={handleClienteLogout}
        />
      }>
        <Route path="/catalogo" element={<CatalogoPublico />} />
        <Route path="/cotizar" element={<Cotizar clienteSession={clienteSession} />} />
        <Route
          path="/mis-cotizaciones"
          element={
            <RequireCliente clienteSession={clienteSession}>
              <MisCotizaciones clienteSession={clienteSession} />
            </RequireCliente>
          }
        />
      </Route>

      {/* Zona Admin */}
      <Route
        element={
          <RequireAdmin session={session} adminVerificado={adminVerificado}>
            <AdminLayout session={session} />
          </RequireAdmin>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/catalogo" element={<Catalogo />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/cotizaciones" element={<Cotizaciones />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/proveedores" element={<Proveedores />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
