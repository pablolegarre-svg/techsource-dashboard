import { useState, useEffect, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import Topbar from '../components/Topbar'
import { supabase } from '../supabase'
import { esPrecioVigente, getUltimaSync } from '../utils/helpers'

const N8N_WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK_COTIZACION

export default function NuevaCotizacion() {
  const [catalogoData, setCatalogoData] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [selectValue, setSelectValue] = useState('')
  const [carrito, setCarrito] = useState([])
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [guardada, setGuardada] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('vista_catalogo_proveedores')
        .select('*')
        .eq('vigente', true)
        .order('nombre', { ascending: true })
      setCatalogoData(data || [])
    }
    cargar()
  }, [])

  const ultimaSync = getUltimaSync(catalogoData)

  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return catalogoData
    return catalogoData.filter((p) =>
      (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
    )
  }, [catalogoData, busqueda])

  function agregarProducto(id) {
    if (!id) return
    const producto = catalogoData.find((p) => String(p.id) === String(id))
    if (!producto) return

    setCarrito((prev) => {
      const existente = prev.find((p) => String(p.producto_id) === String(producto.id))
      if (existente) {
        return prev.map((p) =>
          String(p.producto_id) === String(producto.id)
            ? { ...p, cantidad: p.cantidad + 1, subtotal: (p.cantidad + 1) * p.precio_unitario }
            : p
        )
      }
      const vigente = esPrecioVigente(producto.fecha_sync)
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          proveedor: producto.proveedor,
          precio_unitario: Number(producto.precio_venta),
          moneda: producto.moneda || 'USD',
          cantidad: 1,
          subtotal: Number(producto.precio_venta),
          precio_vigente: vigente,
          fecha_sync: producto.fecha_sync,
        },
      ]
    })
    setSelectValue('')
  }

  function cambiarCantidad(index, value) {
    const cantidad = Math.max(1, parseInt(value) || 1)
    setCarrito((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, cantidad, subtotal: cantidad * p.precio_unitario } : p
      )
    )
  }

  function eliminarProducto(index) {
    setCarrito((prev) => prev.filter((_, i) => i !== index))
  }

  const productosAntiguos = carrito.filter((p) => !p.precio_vigente)
  const total = carrito.reduce((acc, p) => acc + p.subtotal, 0)

  async function guardarCotizacion() {
    if (!clienteNombre.trim() || !clienteEmail.trim()) {
      alert('Debes completar nombre y email del cliente.')
      return
    }
    if (!carrito.length) {
      alert('Debes agregar al menos un producto.')
      return
    }

    setGuardando(true)
    const todosVigentes = carrito.every((p) => p.precio_vigente === true)

    const payload = {
      nombre_cliente: clienteNombre,
      email_cliente: clienteEmail,
      productos: carrito.map((p) => ({
        nombre: p.nombre,
        cantidad: p.cantidad,
        subtotal: p.subtotal,
        categoria: p.categoria,
        proveedor: p.proveedor,
        producto_id: p.producto_id,
        precio_unitario: p.precio_unitario,
        moneda: p.moneda,
        precio_vigente: p.precio_vigente,
      })),
      total,
      fecha_creacion: new Date().toISOString(),
      estado: 'emitida',
      precios_vigentes: todosVigentes,
    }

    try {
      const res = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 409) {
          alert(errData.message || 'Stock insuficiente para uno o más productos de la cotización.')
        } else {
          alert(errData.message || `Error al generar la cotización (código ${res.status}). Intentá de nuevo.`)
        }
        setGuardando(false)
        return
      }

      const data = await res.json().catch(() => ({}))
      if (data.ok === false) {
        alert(data.error || 'Error al generar la cotización.')
        setGuardando(false)
        return
      }
      setGuardada(data?.id ? data : { ...payload, id: data?.id ?? crypto.randomUUID() })
    } catch (err) {
      console.error(err)
      alert('No se pudo conectar con el servidor de cotizaciones. Verificá tu conexión e intentá de nuevo.')
    }

    setGuardando(false)
  }

  function descargarPdf() {
    if (!guardada) return
    generarPdf(guardada)
  }

  function resetear() {
    setCarrito([])
    setClienteNombre('')
    setClienteEmail('')
    setGuardada(null)
    setBusqueda('')
    setSelectValue('')
  }

  if (guardada) {
    return (
      <>
        <Topbar ultimaSync={ultimaSync} />
        <main className="container">
          <section className="card" style={{ marginTop: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 72, lineHeight: 1, color: '#2da66b' }}>◌</div>
            <h2 style={{ marginTop: 12 }}>¡Cotización generada exitosamente!</h2>
            <p className="page-subtitle">
              La cotización para <strong>{guardada.nombre_cliente}</strong> ha sido guardada
              con el ID <code>{String(guardada.id).substring(0, 8)}</code>.
            </p>

            {guardada.precios_vigentes === false && (
              <div
                className="warning-card card"
                style={{ maxWidth: 420, margin: '18px auto 0' }}
              >
                ⚠ Esta cotización contiene precios que fueron actualizados hace más de 48 horas.
                Se recomienda verificar con el proveedor.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
              <button className="btn-topbar" onClick={descargarPdf}>
                ⬇ Descargar PDF
              </button>
              <button
                className="btn-primary"
                style={{ background: '#fff', color: '#1d315d' }}
                onClick={resetear}
              >
                ↻ Solicitar una nueva cotización
              </button>
            </div>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <Topbar ultimaSync={ultimaSync} />
      <main className="container">
        <section className="card">
          <h1 className="page-title">Cotizador</h1>
          <p className="page-subtitle">Genera cotizaciones rápidas para tus clientes</p>
        </section>

        <section className="card" style={{ marginTop: 14 }}>
          <h2 className="section-title">Datos del cliente</h2>
          <div className="filtros-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="label-form">Nombre del cliente</label>
              <input
                className="input-filtro"
                placeholder="Ej. Empresa ABC"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
              />
            </div>
            <div>
              <label className="label-form">Email</label>
              <input
                className="input-filtro"
                placeholder="cliente@ejemplo.com"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 14 }}>
          <h2 className="section-title">Agregar productos</h2>
          <div className="filtros-grid" style={{ gridTemplateColumns: '1.7fr 1fr' }}>
            <input
              className="input-filtro"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <select
              className="input-filtro"
              value={selectValue}
              onChange={(e) => {
                setSelectValue(e.target.value)
                agregarProducto(e.target.value)
              }}
            >
              <option value="">Seleccionar producto</option>
              {productosFiltrados.map((p) => (
                <option key={p.id} value={p.id} disabled={(p.stock_disponible ?? 0) === 0}>
                  {p.nombre} — ${Number(p.precio_venta).toFixed(0)} {p.moneda || ''}{' '}
                  {(p.stock_disponible ?? 0) === 0
                    ? '(Sin stock)'
                    : `(${p.stock_disponible} disp.)`}
                </option>
              ))}
            </select>
          </div>
        </section>

        {productosAntiguos.length > 0 && (
          <section className="card warning-card" style={{ marginTop: 14 }}>
            <p>
              ⚠ <strong>Atención:</strong> el precio de{' '}
              <strong>{productosAntiguos.map((p) => p.nombre).join(', ')}</strong> fue
              actualizado hace más de 48 horas y podría no estar vigente. Último sync:{' '}
              {productosAntiguos
                .map((p) => p.fecha_sync)
                .filter(Boolean)
                .sort()
                .reverse()[0]
                ? new Date(
                    productosAntiguos
                      .map((p) => p.fecha_sync)
                      .filter(Boolean)
                      .sort()
                      .reverse()[0]
                  ).toLocaleString('es-CO')
                : '--'}
              .
            </p>
          </section>
        )}

        <section className="card" style={{ marginTop: 14 }}>
          <h2 className="section-title">Detalle de cotización</h2>

          {carrito.length === 0 ? (
            <p style={{ color: '#6b7c98' }}>Aún no has agregado productos.</p>
          ) : (
            <div className="tabla-wrapper">
              <table className="table table-cotizacion-detalle">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Proveedor</th>
                    <th>Precio Unit.</th>
                    <th>Cantidad</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.map((p, i) => (
                    <tr key={i}>
                      <td>
                        {p.nombre}
                        {!p.precio_vigente && <span className="warn-inline">⚠</span>}
                      </td>
                      <td>
                        <span className="badge badge-blue">{p.proveedor}</span>
                      </td>
                      <td className={!p.precio_vigente ? 'stale-price' : ''}>
                        ${p.precio_unitario.toFixed(0)}
                        {!p.precio_vigente && ' ⚠'}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={p.cantidad}
                          className="qty-input"
                          onChange={(e) => cambiarCantidad(i, e.target.value)}
                        />
                      </td>
                      <td className={!p.precio_vigente ? 'stale-price' : ''}>
                        ${p.subtotal.toFixed(0)}
                      </td>
                      <td>
                        <button className="btn-icon" onClick={() => eliminarProducto(i)}>
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right' }}>
                      <strong>Total General</strong>
                    </td>
                    <td>
                      <strong>${total.toFixed(0)}</strong>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="cotizacion-actions">
            <button
              className="btn-topbar"
              onClick={guardarCotizacion}
              disabled={guardando}
            >
              {guardando ? 'Guardando...' : '✈ Generar Cotización'}
            </button>
          </div>
        </section>
      </main>
    </>
  )
}

function generarPdf(cotizacionGuardada) {
  const doc = new jsPDF('p', 'mm', 'a4')

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  const colors = {
    primary: [29, 49, 93],
    secondary: [47, 111, 237],
    lightBlue: [232, 239, 249],
    border: [220, 228, 240],
    text: [35, 57, 93],
    muted: [107, 124, 152],
    successBg: [215, 243, 227],
    successText: [23, 125, 72],
    warnBg: [255, 247, 232],
    warnBorder: [242, 192, 120],
    warnText: [146, 91, 5],
  }

  let y = 16

  function setText(color = colors.text, size = 10, style = 'normal') {
    doc.setTextColor(...color)
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
  }

  function roundRect(x, yPos, w, h, fillColor = null, drawColor = colors.border) {
    if (fillColor) {
      doc.setFillColor(...fillColor)
      doc.setDrawColor(...drawColor)
      doc.roundedRect(x, yPos, w, h, 3, 3, 'FD')
    } else {
      doc.setDrawColor(...drawColor)
      doc.roundedRect(x, yPos, w, h, 3, 3, 'S')
    }
  }

  function textLine(label, value, x, yPos, labelWidth = 28) {
    setText(colors.muted, 10, 'bold')
    doc.text(label, x, yPos)
    setText(colors.text, 10, 'normal')
    doc.text(value || '', x + labelWidth, yPos)
  }

  function money(value, moneda = 'USD') {
    return `$${Number(value || 0).toFixed(0)} ${moneda}`
  }

  function formatDateLong(fecha) {
    return new Date(fecha).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  function ensureSpace(required) {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (y + required > pageHeight - 18) {
      doc.addPage()
      y = 16
    }
  }

  const productos = Array.isArray(cotizacionGuardada.productos) ? cotizacionGuardada.productos : []
  const productosNoVigentes = productos.filter((p) => p.precio_vigente === false)

  // HEADER
  roundRect(margin, y, contentWidth, 24, [248, 251, 255], colors.border)
  try {
    doc.addImage('/assets/logo.png', 'PNG', margin + 4, y + 3, 28, 18)
  } catch {
    setText(colors.primary, 16, 'bold')
    doc.text('TechSource Solutions', margin + 4, y + 11)
  }

  setText(colors.primary, 16, 'bold')
  doc.text('Cotización', margin + 38, y + 10)
  setText(colors.muted, 9, 'normal')
  doc.text(`ID: ${cotizacionGuardada.id}`, margin + 38, y + 16)
  doc.text(`Fecha de emisión: ${formatDateLong(cotizacionGuardada.fecha_creacion)}`, margin + 38, y + 21)
  y += 32

  // DATOS CLIENTE
  ensureSpace(28)
  roundRect(margin, y, contentWidth, 24, [255, 255, 255], colors.border)
  setText(colors.primary, 12, 'bold')
  doc.text('Datos del cliente', margin + 4, y + 7)
  textLine('Nombre:', cotizacionGuardada.nombre_cliente || '', margin + 4, y + 15)
  textLine('Email:', cotizacionGuardada.email_cliente || '', margin + 4, y + 21)
  y += 30

  // TABLA
  ensureSpace(20)
  setText(colors.primary, 12, 'bold')
  doc.text('Detalle de cotización', margin, y)
  y += 5

  const cols = {
    producto: margin,
    categoria: margin + 58,
    proveedor: margin + 86,
    precio: margin + 122,
    cantidad: margin + 150,
    subtotal: margin + 168,
  }

  const rowHeight = 10
  roundRect(margin, y, contentWidth, rowHeight, colors.lightBlue, colors.border)
  setText(colors.primary, 9, 'bold')
  doc.text('Producto', cols.producto + 2, y + 6.5)
  doc.text('Categoría', cols.categoria + 2, y + 6.5)
  doc.text('Proveedor', cols.proveedor + 2, y + 6.5)
  doc.text('Precio Unit.', cols.precio + 2, y + 6.5)
  doc.text('Cant.', cols.cantidad + 2, y + 6.5)
  doc.text('Subtotal', cols.subtotal + 2, y + 6.5)
  y += rowHeight

  productos.forEach((p) => {
    ensureSpace(12)
    const stale = p.precio_vigente === false
    const rowBg = stale ? [255, 249, 240] : [255, 255, 255]
    roundRect(margin, y, contentWidth, 12, rowBg, colors.border)

    setText(stale ? colors.warnText : colors.text, 8.8, stale ? 'bold' : 'normal')
    doc.text(`${stale ? '⚠ ' : ''}${String(p.nombre || '').slice(0, 30)}`, cols.producto + 2, y + 7.5)
    setText(colors.text, 8.5, 'normal')
    doc.text(String(p.categoria || '').slice(0, 16), cols.categoria + 2, y + 7.5)
    doc.text(String(p.proveedor || '').slice(0, 18), cols.proveedor + 2, y + 7.5)
    setText(stale ? colors.warnText : colors.text, 8.5, stale ? 'bold' : 'normal')
    doc.text(money(p.precio_unitario, p.moneda), cols.precio + 2, y + 7.5)
    setText(colors.text, 8.5, 'normal')
    doc.text(String(p.cantidad || 1), cols.cantidad + 2, y + 7.5)
    setText(stale ? colors.warnText : colors.text, 8.5, stale ? 'bold' : 'normal')
    doc.text(money(p.subtotal, p.moneda), cols.subtotal + 2, y + 7.5)
    y += 12
  })

  // TOTAL
  ensureSpace(16)
  roundRect(margin, y, contentWidth, 12, [248, 251, 255], colors.border)
  setText(colors.primary, 11, 'bold')
  doc.text('TOTAL GENERAL', margin + 122, y + 7.5)
  doc.text(money(cotizacionGuardada.total, 'USD'), margin + 168, y + 7.5)
  y += 18

  // AVISO
  if (productosNoVigentes.length) {
    ensureSpace(28)
    roundRect(margin, y, contentWidth, 24, colors.warnBg, colors.warnBorder)
    setText(colors.warnText, 10, 'bold')
    doc.text('⚠ Atención', margin + 4, y + 7)
    setText(colors.warnText, 9, 'normal')
    doc.text(doc.splitTextToSize('Algunos precios en esta cotización fueron actualizados hace más de 48 horas.', contentWidth - 10), margin + 4, y + 13)
    doc.text(doc.splitTextToSize('Se recomienda confirmar con el proveedor antes de proceder.', contentWidth - 10), margin + 4, y + 18)
    y += 26
    const nota3 = `Productos pendientes: ${productosNoVigentes.map((p) => p.nombre).join(', ')}.`
    const extraLines = doc.splitTextToSize(nota3, contentWidth - 10)
    roundRect(margin, y, contentWidth, 8 + extraLines.length * 4.5, colors.warnBg, colors.warnBorder)
    doc.text(extraLines, margin + 4, y + 7)
    y += 10 + extraLines.length * 4.5
  } else {
    ensureSpace(16)
    roundRect(margin, y, contentWidth, 14, colors.successBg, colors.border)
    setText(colors.successText, 9, 'bold')
    doc.text('✓ Precios vigentes al momento de la emisión. Validez: 48 horas.', margin + 4, y + 8.5)
    y += 20
  }

  // FOOTER
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 16
  setText(colors.muted, 8, 'normal')
  doc.text('Cotización generada automáticamente por TechSource Solutions', margin, footerY - 4)
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, margin, footerY)

  doc.save(`Cotizacion_TechSource_${cotizacionGuardada.id}.pdf`)
}
