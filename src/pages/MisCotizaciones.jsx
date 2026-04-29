import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Pagination, { paginate } from '../components/Pagination'
import { shortId, formatearMoneda, formatearFecha } from '../utils/helpers'
import { generateCotizacionPdf } from '../utils/generatePdf'
import { parseProductos } from './Cotizaciones'

const ESTADO_BADGE = {
  en_espera:  'badge-yellow',
  emitida:    'badge-blue',
  aprobada:   'badge-green',
  aceptada:   'badge-green',
  rechazada:  'badge-red',
  vencida:    'badge-red',
  expiró:     'badge-red',
  expiro:     'badge-red',
  // valores capitalizados que puede devolver la vista
  'En espera': 'badge-yellow',
  'Emitida':   'badge-blue',
  'Aprobada':  'badge-green',
  'Aceptada':  'badge-green',
  'Rechazada': 'badge-red',
  'Vencida':   'badge-red',
  'Expiró':    'badge-red',
}
const ESTADO_LABEL = {
  en_espera:  'En espera',
  emitida:    'Emitida',
  aprobada:   'Aprobada',
  aceptada:   'Aceptada',
  rechazada:  'Rechazada',
  vencida:    'Vencida',
  expiró:     'Expiró',
}

const ESTADOS_VENCIDA = new Set(['vencida', 'expiró', 'expiro', 'Vencida', 'Expiró'])

const N8N_RECOTIZAR = 'https://n8n.srv1164728.hstgr.cloud/webhook/re-cotizar'

export default function MisCotizaciones({ clienteSession }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState(null)
  const [recotizando, setRecotizando] = useState(null)
  const [recotizacionMsg, setRecotizacionMsg] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    const email = clienteSession?.email
    if (!email) return
    supabase
      .from('vista_cotizaciones_clientes')
      .select('*')
      .ilike('email_cliente', email)
      .order('fecha_creacion', { ascending: false })
      .then(({ data }) => { setCotizaciones(data || []); setLoading(false) })
  }, [clienteSession])

  // cambiarEstado deshabilitado: el cliente acepta/rechaza desde el email (flujos N8N cliente-acepta / cliente-cancela)
  // async function cambiarEstado(id, nuevoEstado) {
  //   await supabase.from('cotizaciones').update({ estado: nuevoEstado }).eq('id', id)
  //   setCotizaciones((prev) =>
  //     prev.map((c) => c.id === id ? { ...c, estado: nuevoEstado } : c)
  //   )
  //   if (detalle?.id === id) setDetalle((prev) => ({ ...prev, estado: nuevoEstado }))
  // }

  async function recotizar(cotizacion) {
    setRecotizando(cotizacion.id)
    setRecotizacionMsg(null)
    try {
      const res = await fetch(N8N_RECOTIZAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cotizacion_id: cotizacion.id,
          cliente_id: clienteSession?.id,
        }),
      })
      if (!res.ok) throw new Error('Error en el servidor')
      setRecotizacionMsg({ tipo: 'ok', texto: 'Re-cotización enviada. En breve recibirás un email con los precios actualizados.' })
      // refresca la lista para mostrar la nueva cotización
      const { data } = await supabase
        .from('vista_cotizaciones_clientes')
        .select('*')
        .ilike('email_cliente', clienteSession?.email)
        .order('fecha_creacion', { ascending: false })
      setCotizaciones(data || [])
      setPage(1)
    } catch {
      setRecotizacionMsg({ tipo: 'error', texto: 'No se pudo procesar la re-cotización. Intentá de nuevo más tarde.' })
    } finally {
      setRecotizando(null)
    }
  }

  const paginated = paginate(cotizaciones, page, pageSize)

  const columns = [
    { key: 'id', label: 'ID', render: (r) => shortId(r.id) },
    { key: 'total', label: 'Total', render: (r) => <strong>{formatearMoneda(r.total)}</strong> },
    { key: 'fecha_creacion', label: 'Fecha', render: (r) => formatearFecha(r.fecha_creacion) },
    { key: 'estado', label: 'Estado', render: (r) => (
      <span className={`badge ${ESTADO_BADGE[r.estado] || 'badge-gray'}`}>
        {ESTADO_LABEL[r.estado] || r.estado}
      </span>
    )},
    { key: 'acciones', label: '', style: { width: 200, textAlign: 'right' }, render: (r) => (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
        {ESTADOS_VENCIDA.has(r.estado) ? (
          <button
            className="btn-recotizar"
            title="Re-cotizar con precios actualizados"
            disabled={recotizando === r.id}
            onClick={() => recotizar(r)}
          >
            {recotizando === r.id ? 'Enviando...' : '↻ Re-cotizar'}
          </button>
        ) : (
          <span style={{ display: 'inline-block', width: 106 }} />
        )}
        <button className="btn-icon" title="Ver" onClick={() => setDetalle(r)}>👁</button>
        <button className="btn-icon" title="PDF" onClick={() => generateCotizacionPdf(r)}>⬇</button>
      </div>
    )},
  ]

  return (
    <main className="container">
      <section className="card" style={{ marginBottom: 14 }}>
        <h1 className="page-title">Mis Cotizaciones</h1>
        <p className="page-subtitle">{cotizaciones.length} cotización(es) registradas</p>
        <Link to="/cotizar" className="btn-cotizar-mobile">+ Solicitar Cotización</Link>
      </section>

      {recotizacionMsg && (
        <section
          className={`card recotizacion-msg recotizacion-msg--${recotizacionMsg.tipo}`}
          style={{ marginBottom: 14 }}
        >
          <p style={{ margin: 0 }}>{recotizacionMsg.texto}</p>
          <button className="btn-icon" style={{ marginLeft: 8 }} onClick={() => setRecotizacionMsg(null)}>✕</button>
        </section>
      )}

      <section className="card">
        <Table columns={columns} data={paginated} loading={loading} emptyMessage="Todavía no tenés cotizaciones." />
        <Pagination page={page} pageSize={pageSize} total={cotizaciones.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} label="cotizaciones" />
      </section>

      {detalle && (
        <DetalleModal
          cotizacion={detalle}
          onClose={() => setDetalle(null)}
          // onCambiarEstado deshabilitado — se gestiona desde el email (N8N)
        />
      )}

      {/* Modal confirmación deshabilitado — aceptar/rechazar se hace desde el email (N8N)
      {confirmando && (
        <div className="modal-backdrop" onClick={() => setConfirmando(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            ...
          </div>
        </div>
      )} */}
    </main>
  )
}

function DetalleModal({ cotizacion, onClose, onCambiarEstado }) {
  const productos = parseProductos(cotizacion.productos)
  return (
    <Modal title="Detalle de cotización" onClose={onClose} maxWidth={760}>
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 4px' }}><strong>Total:</strong> {formatearMoneda(cotizacion.total)}</p>
        <p style={{ margin: '0 0 4px' }}><strong>Fecha:</strong> {formatearFecha(cotizacion.fecha_creacion)}</p>
        <p style={{ margin: 0 }}>
          <strong>Estado:</strong>{' '}
          <span className={`badge ${ESTADO_BADGE[cotizacion.estado] || 'badge-gray'}`}>
            {ESTADO_LABEL[cotizacion.estado] || cotizacion.estado}
          </span>
        </p>
      </div>


      <div className="tabla-wrapper">
        <table className="table">
          <thead>
            <tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            {productos.map((p, i) => (
              <tr key={i}>
                <td>{p.nombre}</td>
                <td>{p.cantidad}</td>
                <td>${Number(p.precio_unitario || 0).toFixed(0)}</td>
                <td>${Number(p.subtotal || 0).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn-topbar" onClick={() => generateCotizacionPdf(cotizacion)}>⬇ PDF</button>
      </div>
    </Modal>
  )
}
