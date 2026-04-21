import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import LineChart from '../components/LineChart'

export default function Dashboard() {
  const [catalogo, setCatalogo] = useState([])
  const [historial, setHistorial] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const [{ data: cat }, { data: hist }, { data: cot }] = await Promise.all([
        supabase.from('vista_catalogo_proveedores').select('*'),
        supabase.from('historial_precios').select('*').order('fecha_cambio', { ascending: false }),
        supabase.from('vista_cotizaciones_clientes').select('*'),
      ])
      setCatalogo(cat || [])
      setHistorial(hist || [])
      setCotizaciones(cot || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const vigentes   = catalogo.filter((x) => x.vigente).length
  const proveedores = [...new Set(catalogo.map((x) => x.proveedor).filter(Boolean))].length
  const emitidas   = cotizaciones.filter((c) => c.estado === 'emitida').length
  const aprobadas  = cotizaciones.filter((c) => c.estado === 'aprobada').length

  const chartData = historial
    .slice(0, 12)
    .reverse()
    .map((x) => ({
      x: new Date(x.fecha_cambio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
      y: Number(x.precio_nuevo),
    }))

  const kpis = [
    { label: 'Productos vigentes',   value: vigentes,          icon: '📦', color: '#2f6fed', bg: '#edf4ff' },
    { label: 'Proveedores activos',  value: proveedores,       icon: '🏭', color: '#0ea472', bg: '#e6f9f1' },
    { label: 'Cambios detectados',   value: historial.length,  icon: '📊', color: '#7c3aed', bg: '#f3eeff' },
    { label: 'Cotizaciones totales', value: cotizaciones.length, icon: '🧾', color: '#d97706', bg: '#fff8e6' },
  ]

  const acciones = [
    { to: '/admin/catalogo', icon: '📦', label: 'Catálogo',     desc: 'Productos y precios'    },
    { to: '/proveedores',    icon: '🏭', label: 'Proveedores',  desc: 'Gestión de proveedores' },
    { to: '/historial',      icon: '📊', label: 'Historial',    desc: 'Cambios de precios'     },
    { to: '/cotizaciones',   icon: '🧾', label: 'Cotizaciones', desc: 'Gestión de solicitudes' },
    { to: '/clientes',       icon: '👥', label: 'Clientes',     desc: 'Base de clientes'       },
  ]

  return (
    <div className="container" style={{ paddingTop: 8 }}>

      {/* ── Banner ── */}
      <section className="dash-banner">
        <div>
          <p className="dash-banner-eyebrow">Panel de control</p>
          <h1 className="dash-banner-title">Sincronización de proveedores y precios inteligentes</h1>
          <p className="dash-banner-sub">Monitoreo de proveedores, precios y cotizaciones en tiempo real.</p>
        </div>
        <div className="dash-banner-badge">
          <span className="dash-banner-badge-dot" />
          Sistema operativo
        </div>
      </section>
      {/* ── Accesos rápidos ── */}

      <section>
        <h2 style={{ marginBottom: 12 }}>Accesos rápidos</h2>
        <div className="dash-acciones">
          {acciones.map((a) => (
            <Link key={a.to} to={a.to} className="dash-accion-card">
              <span className="dash-accion-icon">{a.icon}</span>
              <span className="dash-accion-label">{a.label}</span>
              <span className="dash-accion-desc">{a.desc}</span>
              <span className="dash-accion-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>
      <h2 style={{ marginBottom: 12 }}>Resumen general</h2>

      {/* ── KPIs ── */}
{/* ── KPIs ── */}
      <section className="kpis">
        {kpis.map((k) => (
          <div 
            key={k.label} 
            className="card kpi dash-kpi" 
            style={{ 
              '--kpi-color': k.color, 
              '--kpi-bg': k.bg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '24px 16px', // Le da aire para que respire el diseño
              gap: '8px' // Separa el ícono, el número y el texto
            }}
          >
            {/* Ícono */}
            <div className="dash-kpi-icon" style={{ margin: 0 }}>
              {k.icon}
            </div>
            
            {/* Número */}
            <p className="dash-kpi-value" style={{ margin: 0, lineHeight: 1 }}>
              {loading ? '—' : k.value.toLocaleString()}
            </p>
            
            {/* Texto (Aseguramos que no tenga mayúsculas sostenidas) */}
            <h3 className="dash-kpi-label" style={{ margin: 0, textTransform: 'none' }}>
              {k.label}
            </h3>
          </div>
        ))}
      </section>

      {/* ── Grid principal ── */}
      <section className="grid-two">

        {/* Cambios recientes */}
        <div className="card card-scroll">
          <div className="card-header">
            <h2>Últimos cambios de precio</h2>
            <Link to="/historial" className="link-ver">Ver todo →</Link>
          </div>
          <div className="card-scroll-inner">
            {loading
              ? <p className="table-loading">Cargando…</p>
              : <CambiosList rows={historial.slice(0, 20)} />
            }
          </div>
        </div>

        {/* Chart + estado cotizaciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card card-fixed">
            <h2>Historial de precios</h2>
            <LineChart data={chartData} height={150} />
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 10 }}>Estado de cotizaciones</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <EstadoBar label="Emitidas"  value={emitidas}  total={cotizaciones.length} color="#2f6fed" loading={loading} />
              <EstadoBar label="Aprobadas" value={aprobadas} total={cotizaciones.length} color="#0ea472" loading={loading} />
              <EstadoBar
                label="Vencidas"
                value={cotizaciones.filter((c) => c.estado === 'vencida').length}
                total={cotizaciones.length}
                color="#d97706"
                loading={loading}
              />
            </div>
          </div>
        </div>

      </section>



    </div>
  )
}

function CambiosList({ rows }) {
  if (!rows.length) return <p style={{ color: '#6b7c98', fontSize: '0.9rem', padding: '12px 0' }}>No hay cambios recientes.</p>
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map((r, i) => {
        const ant  = Number(r.precio_anterior || 0)
        const nvo  = Number(r.precio_nuevo || 0)
        const diff = nvo - ant
        const sube = diff > 0
        return (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid #f0f4fb' }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: sube ? '#fde8e8' : '#e6f9f1',
              color: sube ? '#c0392b' : '#0ea472',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 600,
            }}>
              {diff === 0 ? '•' : sube ? '▲' : '▼'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#1d315d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.nombre || r.sku}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9aaabf' }}>{r.proveedor || r.source}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: sube ? '#c0392b' : '#0ea472' }}>
                {sube ? '+' : ''}{diff.toFixed(2)}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9aaabf' }}>{nvo.toFixed(2)}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function EstadoBar({ label, value, total, color, loading }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#5b6f93' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d315d' }}>
          {loading ? '—' : value} <span style={{ color: '#9aaabf', fontWeight: 500 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: '#eef2f8', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}
