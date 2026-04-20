import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const links = [
  { to: '/dashboard',      label: 'Resumen' },
  { to: '/admin/catalogo', label: 'Catálogo' },
  { to: '/proveedores',    label: 'Proveedores' },
  { to: '/historial',      label: 'Historial' },
  { to: '/cotizaciones',   label: 'Cotizaciones' },
  { to: '/clientes',       label: 'Clientes' },
]

export default function AdminNavbar() {
  const [ultimaSync, setUltimaSync] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('vista_catalogo_proveedores')
      .select('fecha_sync')
      .order('fecha_sync', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]?.fecha_sync) setUltimaSync(data[0].fecha_sync)
      })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/catalogo', { replace: true })
  }

  const syncText = ultimaSync
    ? new Date(ultimaSync).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '--'

  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar-logo">
          <img src="/assets/logo.png" alt="TechSource" />
        </div>

        <nav className="admin-topbar-nav">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-topbar-right">
          <div className="admin-sync-pill">
            <span>◔</span>
            <span>Sync: {syncText}</span>
          </div>
          <button className="admin-nueva-btn" onClick={() => navigate('/cotizaciones')}>
            + Cotización
          </button>
          <button className="admin-logout-btn" onClick={handleLogout} title="Salir">⏻</button>
        </div>

        <button
          className="admin-hamburger"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Menú"
        >
          <span /><span /><span />
        </button>
      </header>

      {menuAbierto && (
        <div className="admin-mobile-menu" onClick={() => setMenuAbierto(false)}>
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) => `admin-mobile-link${isActive ? ' active' : ''}`}
              onClick={() => setMenuAbierto(false)}
            >
              {label}
            </NavLink>
          ))}
          <div className="admin-mobile-divider" />
          <button className="admin-mobile-logout" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      )}
    </>
  )
}
