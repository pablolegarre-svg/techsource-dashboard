import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Pagination, { paginate } from '../components/Pagination'
import QuoteModal from '../components/QuoteModal'
import { shortId, formatearMoneda, formatearFecha } from '../utils/helpers'
import { generateCotizacionPdf } from '../utils/generatePdf'

export function parseProductos(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return [] }
  }
  if (typeof raw !== 'object' || raw === null) return []
  // Single product object (has product fields directly)
  if ('nombre' in raw || 'producto_id' in raw) return [raw]
  // Map of products {0: {...}, 1: {...}}
  const vals = Object.values(raw)
  return vals.every((v) => typeof v === 'object' && v !== null) ? vals : []
}

const ESTADOS = [
  { value: 'en_espera', label: 'En espera', badge: 'badge-yellow' },
  { value: 'emitida',   label: 'Emitida',   badge: 'badge-blue'   },
  { value: 'aprobada',  label: 'Aprobada',  badge: 'badge-green'  },
  { value: 'vencida',   label: 'Vencida',   badge: 'badge-gray'   },
]

// Todos los estados posibles (incluyendo rechazada, que solo puede setear el cliente)
const ESTADOS_TODOS = [
  ...ESTADOS,
  { value: 'rechazada', label: 'Rechazada', badge: 'badge-red' },
]

function EstadoBadge({ estado }) {
  const e = ESTADOS_TODOS.find((x) => x.value === estado) || { label: estado, badge: 'badge-gray' }
  return <span className={`badge ${e.badge}`}>{e.label}</span>
}

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [validacion, setValidacion] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [showQuote, setShowQuote] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  function cargar() {
    setLoading(true)
    supabase
      .from('cotizaciones_con_estado')
      .select('*')
      .order('fecha_creacion', { ascending: false })
      .then(({ data }) => { setCotizaciones(data || []); setLoading(false) })
  }

  useEffect(cargar, [])

  async function cambiarEstado(id, nuevoEstado) {
    await supabase.from('cotizaciones').update({ estado: nuevoEstado }).eq('id', id)
    setCotizaciones((prev) =>
      prev.map((c) => c.id === id ? { ...c, estado: nuevoEstado } : c)
    )
    if (detalle?.id === id) setDetalle((prev) => ({ ...prev, estado: nuevoEstado }))
  }

  const filtrado = useMemo(() => {
    return cotizaciones.filter((item) => {
      const id = (item.id || '').toLowerCase()
      const cliente = (item.nombre_completo || '').toLowerCase()
      const email = (item.email || '').toLowerCase()
      const fecha = item.fecha_creacion ? new Date(item.fecha_creacion) : null
      const cumpleTexto = !busqueda || id.includes(busqueda.toLowerCase()) || cliente.includes(busqueda.toLowerCase()) || email.includes(busqueda.toLowerCase())
      const cumpleEstado = !filtroEstado || item.estado === filtroEstado
      let cumpleValidacion = true
      if (validacion === 'vigentes') cumpleValidacion = item.precios_vigentes === true
      else if (validacion === 'verificacion') cumpleValidacion = item.precios_vigentes === false
      const cumpleDesde = !desde || !fecha || fecha >= new Date(`${desde}T00:00:00`)
      const cumpleHasta = !hasta || !fecha || fecha <= new Date(`${hasta}T23:59:59`)
      return cumpleTexto && cumpleEstado && cumpleValidacion && cumpleDesde && cumpleHasta
    })
  }, [cotizaciones, busqueda, filtroEstado, validacion, desde, hasta])

  const paginated = paginate(filtrado, page, pageSize)

  const columns = [
    { key: 'id', label: 'ID', render: (r) => shortId(r.id) },
    { key: 'email', label: 'Email' },
    { key: 'total', label: 'Total', render: (r) => <strong>{formatearMoneda(r.total)}</strong> },
    { key: 'fecha_creacion', label: 'Fecha', render: (r) => formatearFecha(r.fecha_creacion) },
    {
      key: 'estado', label: 'Estado',
      render: (r) => (
        <select
          value={r.estado || 'emitida'}
          onChange={(e) => cambiarEstado(r.id, e.target.value)}
          className="estado-select"
          onClick={(e) => e.stopPropagation()}
        >
          {ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      ),
    },
    { key: 'mas_tres_dias', label: 'Vigencia', render: (r) =>
      r.mas_tres_dias === 'Expiró'
        ? <span className="badge badge-red">Expiró</span>
        : <span className="badge badge-green">Vigente</span>
    },
    { key: 'acciones', label: '', render: (r) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn-icon" title="Ver detalle" onClick={() => setDetalle(r)}>👁</button>
        <button className="btn-icon" title="Descargar PDF" onClick={() => generateCotizacionPdf(r, { isAdmin: true })}>⬇</button>
      </div>
    )},
  ]

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cotizaciones</h1>
          <p className="page-subtitle">{filtrado.length} cotización(es)</p>
        </div>
        <button className="btn-topbar" onClick={() => setShowQuote(true)}>+ Solicitar Cotización</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filtros-grid filtros-cotizaciones">
          <input className="input-filtro" placeholder="Buscar por email, nombre o ID..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1) }} />
          <select className="input-filtro" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPage(1) }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <input type="date" className="input-filtro" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(1) }} />
          <input type="date" className="input-filtro" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card">
        <Table columns={columns} data={paginated} loading={loading} emptyMessage="No se encontraron cotizaciones." />
        <Pagination page={page} pageSize={pageSize} total={filtrado.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} label="cotizaciones" />
      </div>

      {detalle && (
        <DetalleModal
          cotizacion={detalle}
          onClose={() => setDetalle(null)}
          onCambiarEstado={cambiarEstado}
        />
      )}
      {showQuote && <QuoteModal onClose={() => setShowQuote(false)} onSaved={cargar} />}
    </div>
  )
}

function DetalleModal({ cotizacion, onClose, onCambiarEstado }) {
  const productos = parseProductos(cotizacion.productos)
  const hayAntiguos = productos.some((p) => p.precio_vigente === false)

  return (
    <Modal title="Detalle de cotización" onClose={onClose} maxWidth={860}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <p style={{ margin: '0 0 4px' }}><strong>Cliente:</strong> {cotizacion.nombre_completo}</p>
          <p style={{ margin: '0 0 4px' }}><strong>Email:</strong> {cotizacion.email}</p>
          <p style={{ margin: 0 }}><strong>Total:</strong> {formatearMoneda(cotizacion.total)} <span style={{ color: '#6b7c98', fontWeight: 400, fontSize: '0.85rem' }}>USD</span></p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7c98', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</span>
          <select
            value={cotizacion.estado || 'emitida'}
            onChange={(e) => onCambiarEstado(cotizacion.id, e.target.value)}
            className="estado-select"
          >
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="tabla-wrapper">
        <table className="table">
          <thead>
            <tr><th>Producto</th><th>Proveedor</th><th>Precio Unit.</th><th>Cantidad</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            {productos.length === 0 && (
              <tr><td colSpan={5} style={{ color: '#9aaabf', padding: '16px', textAlign: 'center' }}>Sin productos registrados</td></tr>
            )}
            {productos.map((p, i) => {
              const stale = p.precio_vigente === false
              return (
                <tr key={i}>
                  <td>{p.nombre}</td>
                  <td>{p.proveedor || ''}</td>
                  <td style={{ color: stale ? '#E67E22' : undefined, fontWeight: stale ? 700 : undefined }}>
                    {stale ? '⚠ ' : ''}${Number(p.precio_unitario || 0).toFixed(0)}
                  </td>
                  <td>{p.cantidad || 1}</td>
                  <td>${Number(p.subtotal || 0).toFixed(0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hayAntiguos && (
        <p style={{ color: '#E67E22', fontSize: '0.9rem', marginTop: 12 }}>
          ⚠ Los productos marcados tenían precios con más de 48 horas al momento de emisión.
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn-topbar" onClick={() => generateCotizacionPdf(cotizacion, { isAdmin: true })}>⬇ PDF</button>
      </div>
    </Modal>
  )
}
