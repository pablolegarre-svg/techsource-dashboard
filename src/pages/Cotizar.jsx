import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { esPrecioVigente } from '../utils/helpers'
import { generateCotizacionPdf } from '../utils/generatePdf'

export default function Cotizar({ clienteSession }) {
  const [catalogo, setCatalogo] = useState([])
  const [clienteData, setClienteData] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '' })
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([])
  const [guardada, setGuardada] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase
      .from('vista_catalogo_proveedores')
      .select('*')
      .eq('vigente', true)
      .order('nombre', { ascending: true })
      .then(({ data }) => setCatalogo(data || []))
  }, [])

  useEffect(() => {
    if (!clienteSession?.email) return
    setClienteData(clienteSession)
  }, [clienteSession])

  const productosFiltrados = useMemo(() =>
    catalogo.filter((p) =>
      p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.sku?.toLowerCase().includes(busqueda.toLowerCase())
    ),
    [catalogo, busqueda]
  )

  function agregar(producto) {
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
      }]
    })
  }

  function cambiarCantidad(idx, cantidad) {
    const cant = Math.max(1, parseInt(cantidad) || 1)
    setCarrito((prev) => prev.map((p, i) =>
      i === idx ? { ...p, cantidad: cant, subtotal: cant * p.precio_unitario } : p
    ))
  }

  function eliminar(idx) {
    setCarrito((prev) => prev.filter((_, i) => i !== idx))
  }

  const totalProductos = carrito.length
  const totalUnidades  = carrito.reduce((acc, p) => acc + p.cantidad, 0)
  const total          = carrito.reduce((acc, p) => acc + p.subtotal, 0)
  const moneda         = carrito[0]?.moneda || 'USD'
  const productosAntiguos = carrito.filter((p) => !p.precio_vigente)

  const nombreCliente = clienteSession ? clienteData?.nombre_completo || clienteSession.email : form.nombre
  const emailCliente  = clienteSession ? clienteData?.email || clienteSession.email : form.email

  async function guardar() {
    if (!nombreCliente.trim() || !emailCliente.trim()) { alert('Completá tus datos.'); return }
    if (!carrito.length) { alert('Agregá al menos un producto.'); return }
    setGuardando(true)

    const payload = {
      nombre_cliente: nombreCliente,
      email_cliente: emailCliente,
      telefono: form.telefono || null,
      productos: carrito.map(({ nombre, cantidad, subtotal, categoria, proveedor, producto_id, precio_unitario, moneda, precio_vigente }) =>
        ({ nombre, cantidad, subtotal, categoria, proveedor, producto_id, precio_unitario, moneda, precio_vigente })
      ),
      total,
      fecha_creacion: new Date().toISOString(),
      estado: 'emitida',
      precios_vigentes: carrito.every((p) => p.precio_vigente),
    }

    try {
      const res = await fetch(import.meta.env.VITE_N8N_WEBHOOK_COTIZACION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error del servidor')
      // N8N responde 200 sin body — construimos el estado de éxito con los datos locales
      setGuardada({
        nombre_cliente: nombreCliente,
        email_cliente: emailCliente,
        precios_vigentes: payload.precios_vigentes,
        productos: payload.productos,
        total,
        fecha_creacion: payload.fecha_creacion,
        id: crypto.randomUUID(), // placeholder para mostrar ID corto
      })
    } catch {
      alert('Error al enviar la cotización. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // ── Éxito ────────────────────────────────────────────────────────────────
  if (guardada) {
    return (
      <main className="cotizar-page" style={{ maxWidth: 520 }}>
        <div className="cotizar-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem' }}>¡Cotización enviada!</h2>
          <p style={{ color: '#5b6f93', margin: '0 0 4px' }}>
            Para <strong>{guardada.nombre_cliente}</strong>
          </p>
          <p style={{ color: '#9aaabf', fontSize: '0.82rem', marginBottom: 24 }}>
            ID {String(guardada.id).substring(0, 8)} · Te enviamos un correo con el resumen de tu cotización.
          </p>
          <p style={{ color: '#5b6f93', fontSize: '0.88rem', marginBottom: 16 }}>
          Te enviamos un correo con el detalle completo para que puedas revisarlo.
          </p>
          {!guardada.precios_vigentes && (
            <div className="warning-card" style={{ marginBottom: 20, textAlign: 'center' }}>
              ⚠ Algunos precios pueden haber cambiado, te lo confirmamos al contactarte.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-topbar" onClick={() => generateCotizacionPdf(guardada)}>⬇ Descargar PDF</button>
            <button className="btn-primary" onClick={() => { setGuardada(null); setCarrito([]) }}>↻ Nueva cotización</button>
            {clienteSession && <Link to="/mis-cotizaciones" className="btn-primary">Mis cotizaciones</Link>}
          </div>
        </div>
      </main>
    )
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <main className="cotizar-page">
      <div className="cotizar-layout">

        {/* ── Columna principal ── */}
        <div className="cotizar-main-col">

          {/* 1. Tus datos */}
          <div className="cotizar-card">
                    <div className="cotizar-card-header">
            <h2>Tus datos</h2>
            {!clienteSession && (
              <p style={{ fontSize: '0.82rem', color: '#5b6f93', margin: '4px 0 0 0', textAlign: 'right' }}>
               <Link to="/login" style={{ color: '#2f6fed', fontWeight: 600, textDecoration: 'none' }}>
                  Iniciá sesión
                </Link>
                {' '}para ver tu historial de cotizaciones
              </p>
            )}
          </div>
            {clienteSession && clienteData ? (
              <div className="cliente-card">
                <div className="cliente-card-avatar">
                  {(clienteData.nombre_completo || '?')[0].toUpperCase()}
                </div>
                <div className="cliente-card-info">
                  <strong>{clienteData.nombre_completo}</strong>
                  <span>{clienteData.email}</span>
                </div>
              </div>
            ) : (
              <div className="cotizar-form-grid">
                <div className="cotizar-field cotizar-field-wide">
                  <label>NOMBRE COMPLETO *</label>
                  <input className="input-filtro" placeholder="Tu nombre"
                    value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="cotizar-field">
                  <label>EMAIL *</label>
                  <input className="input-filtro" placeholder="tu@email.com" type="email"
                    value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="cotizar-field">
                  <label>TELÉFONO</label>
                  <input className="input-filtro" placeholder="Opcional"
                    value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
                </div>
              </div>
            )}
          </div>

          {/* 2. Catálogo / Buscador (Subió de posición) */}
          <div className="cotizar-card">
            <div className="cotizar-card-header" style={{ marginBottom: 10 }}>
              <h2>Buscar productos</h2>
              {busqueda && (
                <button onClick={() => setBusqueda('')}
                  style={{ background: 'none', border: 'none', color: '#9aaabf', cursor: 'pointer', fontSize: '0.82rem' }}>
                  Limpiar ✕
                </button>
              )}
            </div>

            <input
              className="input-filtro"
              placeholder="🔍  Buscar por nombre o SKU..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoComplete="off"
              style={{ marginBottom: 12, padding: '12px 16px', fontSize: '1rem' }}
            />

            <ul className="product-inline-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {productosFiltrados.length === 0 ? (
                <li className="product-inline-empty">Sin resultados para "{busqueda}"</li>
              ) : (
                productosFiltrados.map((p) => {
                  const idx = carrito.findIndex((c) => String(c.producto_id) === String(p.id))
                  const enCarrito = idx >= 0
                  return (
                    <li key={p.id} className={`product-inline-item${enCarrito ? ' in-cart' : ''}`}>
                      <div className="product-inline-info">
                        <span className="product-search-name">{p.nombre}</span>
                        <span style={{ fontSize: '0.72rem', color: '#9aaabf' }}>{p.categoria}</span>
                      </div>
                      <div className="product-inline-right">
                        <span className="product-search-price">${Number(p.precio_venta).toFixed(0)} {p.moneda}</span>
                        
                        {enCarrito ? (
                          <span style={{ fontSize: '0.85rem', color: '#0ea472', fontWeight: 600, padding: '4px 8px' }}>✓ Agregado</span>
                        ) : (
                          <button className="product-inline-add" onClick={(e) => { e.stopPropagation(); agregar(p) }}>+ Agregar</button>
                        )}
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </div>

          {/* 3. Productos seleccionados */}
          {carrito.length > 0 && (
            <div className="cotizar-card">
              <h2 className="cotizar-card-title" style={{ marginBottom: 16 }}>Productos seleccionados ({carrito.length})</h2>
              <ul className="cotizar-cart-list">
                {carrito.map((p, i) => (
                  <li key={i} className={`cotizar-cart-item2${!p.precio_vigente ? ' stale' : ''}`}>
                    <div className="cotizar-cart2-info">
                      <span className="cotizar-cart2-name">{p.nombre}</span>
                      <span className="cotizar-cart2-cat">{p.categoria}</span>
                      {!p.precio_vigente && (
                        <span className="cotizar-cart2-stale">⚠ Producto sin actualizar hace +48 hs.</span>
                      )}
                    </div>
                    <div className="cotizar-cart2-controls">
                      <div className="product-inline-qty">
                        <button onClick={() => p.cantidad === 1 ? eliminar(i) : cambiarCantidad(i, p.cantidad - 1)}>−</button>
                        <span>{p.cantidad}</span>
                        <button onClick={() => cambiarCantidad(i, p.cantidad + 1)}>+</button>
                      </div>
                      <span className="cotizar-cart2-price">
                        ${p.subtotal.toFixed(0)} <span className="cotizar-cart2-moneda">{p.moneda}</span>
                      </span>
                      <button className="cotizar-cart2-del" onClick={() => eliminar(i)} title="Eliminar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>{/* fin cotizar-main-col */}

        {/* ── Sidebar Resumen ── */}
        <aside className="cotizar-sidebar-col">
          <div className="cotizar-card cotizar-resumen-compact">
            <h2>Resumen</h2>

            <div className="cotizar-resumen-row-item">
              <span>Productos</span>
              <span>{totalProductos}</span>
            </div>
            <div className="cotizar-resumen-row-item">
              <span>Unidades</span>
              <span>{totalUnidades}</span>
            </div>

            <div className="cotizar-resumen-total-block">
              <span>Total estimado</span>
              <span>{moneda} {Math.round(total).toLocaleString('es-AR')} <sup style={{ fontSize: '0.7em', color: '#9aaabf' }}>*</sup></span>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#9aaabf', margin: '4px 0 0', textAlign: 'right' }}>* Precios pueden variar</p>

            {productosAntiguos.length > 0 && (
              <div className="cotizar-warning-block">
                <div className="cotizar-warning-icon">⚠</div>
                <div>
                  <div className="cotizar-warning-title">Precios desactualizados</div>
                  <div className="cotizar-warning-desc">
                    {productosAntiguos.length === 1
                      ? '1 producto tiene precio con más de 48 hs.'
                      : `${productosAntiguos.length} productos sin actualizar hace +48 hs.`}
                  </div>
                </div>
              </div>
            )}

            <button className="cotizar-submit-btn" onClick={guardar} disabled={guardando || !carrito.length}>
              {guardando ? 'Enviando...' : 'Solicitar Cotización'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9aaabf', margin: '8px 0 0' }}>
Te enviamos un correo con el detalle completo para que puedas revisarlo.            </p>
          </div>
        </aside>

      </div>
    </main>
  )
}