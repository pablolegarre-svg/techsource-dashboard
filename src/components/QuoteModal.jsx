import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { esPrecioVigente } from '../utils/helpers'
import { generateCotizacionPdf } from '../utils/generatePdf'

export default function QuoteModal({ onClose, onSaved }) {
  const [catalogo, setCatalogo]       = useState([])
  const [busqueda, setBusqueda]       = useState('')
  const [selectValue, setSelectValue] = useState('')
  const [carrito, setCarrito]         = useState([])
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteEmail, setClienteEmail]   = useState('')
  const [guardando, setGuardando]     = useState(false)
  const [guardada, setGuardada]       = useState(null)

  useEffect(() => {
    supabase
      .from('vista_catalogo_proveedores')
      .select('*')
      .eq('vigente', true)
      .order('nombre', { ascending: true })
      .then(({ data }) => setCatalogo(data || []))
  }, [])

  const productosFiltrados = useMemo(() =>
    busqueda.trim()
      ? catalogo.filter((p) => p.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
      : catalogo,
    [catalogo, busqueda]
  )

  function agregar(id) {
    if (!id) return
    const producto = catalogo.find((p) => String(p.id) === String(id))
    if (!producto) return
    setCarrito((prev) => {
      const ex = prev.find((p) => String(p.producto_id) === String(producto.id))
      if (ex) return prev.map((p) =>
        String(p.producto_id) === String(producto.id)
          ? { ...p, cantidad: p.cantidad + 1, subtotal: (p.cantidad + 1) * p.precio_unitario }
          : p
      )
      return [...prev, {
        producto_id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria,
        proveedor: producto.proveedor,
        precio_unitario: Number(producto.precio_venta),
        moneda: producto.moneda || 'USD',
        cantidad: 1,
        subtotal: Number(producto.precio_venta),
        precio_vigente: esPrecioVigente(producto.fecha_sync),
        fecha_sync: producto.fecha_sync,
      }]
    })
    setSelectValue('')
  }

  function cambiarCantidad(i, val) {
    const cantidad = Math.max(1, parseInt(val) || 1)
    setCarrito((prev) => prev.map((p, idx) =>
      idx === i ? { ...p, cantidad, subtotal: cantidad * p.precio_unitario } : p
    ))
  }

  function eliminar(i) {
    setCarrito((prev) => prev.filter((_, idx) => idx !== i))
  }

  const total = carrito.reduce((acc, p) => acc + p.subtotal, 0)
  const hayDesactualizados = carrito.some((p) => !p.precio_vigente)

  async function guardar() {
    if (!clienteNombre.trim() || !clienteEmail.trim()) {
      alert('Completá nombre y email del cliente.')
      return
    }
    if (!carrito.length) {
      alert('Agregá al menos un producto.')
      return
    }
    setGuardando(true)
    const { data, error } = await supabase
      .from('cotizaciones')
      .insert([{
        nombre_cliente: clienteNombre,
        email_cliente: clienteEmail,
        productos: carrito.map(({ nombre, cantidad, subtotal, categoria, proveedor, producto_id, precio_unitario, moneda, precio_vigente }) =>
          ({ nombre, cantidad, subtotal, categoria, proveedor, producto_id, precio_unitario, moneda, precio_vigente })
        ),
        total,
        fecha_creacion: new Date().toISOString(),
        estado: 'emitida',
        precios_vigentes: carrito.every((p) => p.precio_vigente),
      }])
      .select()
      .single()
    setGuardando(false)
    if (error) { alert('Error al guardar.'); return }
    setGuardada(data)
    onSaved?.()
  }

  // ── Éxito ────────────────────────────────────────────
  if (guardada) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="qm-box" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 52, color: '#2da66b', marginBottom: 12 }}>◌</div>
          <h3 style={{ margin: '0 0 6px', color: '#1d315d' }}>¡Cotización generada!</h3>
          <p style={{ color: '#6a7d9c', margin: '0 0 4px' }}>Cliente: <strong>{guardada.nombre_cliente}</strong></p>
          <p style={{ color: '#9aaabf', fontSize: '0.82rem', marginBottom: 20 }}>
            ID {String(guardada.id).substring(0, 8)}
          </p>
          {!guardada.precios_vigentes && (
            <div className="qm-alert" style={{ marginBottom: 16 }}>
              ⚠️ Algunos precios tienen más de 48 horas. Verificar con proveedor.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button className="btn-topbar" onClick={() => generateCotizacionPdf(guardada, { isAdmin: true })}>⬇ PDF</button>
            <button className="btn-primary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario ───────────────────────────────────────
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="qm-box" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="qm-header">
          <h2 className="qm-title">Solicitar cotización</h2>
          <button className="qm-close" onClick={onClose}>✕</button>
        </div>

        {/* Datos cliente */}
        <div className="qm-grid-2">
          <div className="qm-field">
            <label className="qm-label">Nombre del cliente</label>
            <input className="qm-input" placeholder="Empresa ABC" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
          </div>
          <div className="qm-field">
            <label className="qm-label">Email</label>
            <input className="qm-input" placeholder="cliente@ejemplo.com" type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
          </div>
        </div>

        {/* Buscador + select */}
        <div className="qm-grid-2" style={{ marginTop: 14 }}>
          <input className="qm-input" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <select className="qm-input" value={selectValue} onChange={(e) => { setSelectValue(e.target.value); agregar(e.target.value) }}>
            <option value="">Seleccionar producto...</option>
            {productosFiltrados.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} — {p.moneda} {Number(p.precio_venta).toFixed(0)}</option>
            ))}
          </select>
        </div>

        {/* Alerta desactualizados */}
        {hayDesactualizados && (
          <div className="qm-alert">
            ⚠️ Hay precios desactualizados en esta cotización. Revisá los ítems marcados antes de generar el documento.
          </div>
        )}

        {/* Tabla */}
        {carrito.length > 0 && (
          <div className="qm-table-wrap">
            <table className="qm-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Cant.</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {carrito.map((p, i) => (
                  <tr key={i}>
                    <td className="qm-td-nombre">{p.nombre}</td>
                    <td>
                      <div className="qm-precio-cell">
                        <strong>${p.precio_unitario.toFixed(0)}</strong>
                        {!p.precio_vigente && <span className="qm-badge-stale">Desactualizado</span>}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number" min="1" value={p.cantidad}
                        className="qm-qty"
                        onChange={(e) => cambiarCantidad(i, e.target.value)}
                      />
                    </td>
                    <td className="qm-td-sub">${p.subtotal.toFixed(0)}</td>
                    <td>
                      <button className="qm-del" onClick={() => eliminar(i)} title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="qm-footer">
          {carrito.length > 0 && (
            <span className="qm-total">
              Total: <strong>USD ${total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</strong>
            </span>
          )}
          <button className="qm-btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Generar Cotización'}
          </button>
        </div>

      </div>
    </div>
  )
}
