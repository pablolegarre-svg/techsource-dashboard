import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { formatearMoneda } from '../utils/helpers'

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const idCotizacion = searchParams.get('id_cotizacion')
  const idCliente = searchParams.get('id_cliente')
  const idGestion = searchParams.get('id_gestion')

  const [cotizacion, setCotizacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [exito, setExito] = useState(false)

  // Formulario de facturación
  const [formFacturacion, setFormFacturacion] = useState({
    nombre_completo: '',
    cuit_dni: '',
    direccion_facturacion: '',
    provincia_facturacion: '',
    telefono: '',
  })

  // Método de pago
  const [metodoPago, setMetodoPago] = useState('transferencia')
  const [datosTarjeta, setDatosTarjeta] = useState({
    numero: '',
    vencimiento: '',
    cvv: '',
  })

  // Datos de envío
  const [mismaFacturacion, setMismaFacturacion] = useState(true)
  const [formEnvio, setFormEnvio] = useState({
    direccion_envio: '',
    ciudad: '',
    codigo_postal: '',
    provincia_envio: '',
  })

  // Tipo de envío
  const [tipoEnvio, setTipoEnvio] = useState('correo-argentino')
  const costosEnvio = {
    'correo-argentino': 0,
    'andreani': 3500,
    'retiro-sucursal': 0,
  }

  useEffect(() => {
    if (!idCotizacion) {
      setError('Parámetros inválidos. Falta id_cotizacion.')
      setLoading(false)
      return
    }

    fetchCotizacion()
  }, [idCotizacion])

  async function fetchCotizacion() {
    try {
      const { data, error: err } = await supabase
        .from('cotizaciones')
        .select('*')
        .eq('id', idCotizacion)
        .single()

      if (err || !data) {
        setError('No se encontró la cotización. Verifica el enlace.')
        return
      }

      setCotizacion(data)
      // Pre-llenar algunos campos si viene el email del cliente
      if (data.email_cliente) {
        setFormFacturacion((prev) => ({
          ...prev,
          nombre_completo: data.nombre_cliente || '',
        }))
      }
    } catch (err) {
      setError('Error al cargar la cotización. Intenta nuevamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleFacturacionChange(e) {
    const { name, value } = e.target
    setFormFacturacion((prev) => ({ ...prev, [name]: value }))
  }

  function handleEnvioChange(e) {
    const { name, value } = e.target
    setFormEnvio((prev) => ({ ...prev, [name]: value }))
  }

  function handleTarjetaChange(e) {
    const { name, value } = e.target
    setDatosTarjeta((prev) => ({ ...prev, [name]: value }))
  }

  async function handleConfirmar() {
    // Validar campos requeridos
    if (
      !formFacturacion.nombre_completo.trim() ||
      !formFacturacion.cuit_dni.trim() ||
      !formFacturacion.direccion_facturacion.trim() ||
      !formFacturacion.provincia_facturacion.trim()
    ) {
      alert('Por favor completa todos los datos de facturación.')
      return
    }

    if (!mismaFacturacion) {
      if (
        !formEnvio.direccion_envio.trim() ||
        !formEnvio.ciudad.trim() ||
        !formEnvio.codigo_postal.trim() ||
        !formEnvio.provincia_envio.trim()
      ) {
        alert('Por favor completa todos los datos de envío.')
        return
      }
    }

    if (metodoPago === 'tarjeta') {
      if (!datosTarjeta.numero.trim() || !datosTarjeta.vencimiento.trim() || !datosTarjeta.cvv.trim()) {
        alert('Por favor completa los datos de la tarjeta.')
        return
      }
    }

    setProcesando(true)

    try {
      // Aquí se podría integrar con N8N u otro backend para procesar la compra
      // Por ahora solo mostramos un mensaje de éxito
      
      // Simular un pequeño delay de procesamiento
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setExito(true)
    } catch (err) {
      alert('Error al procesar la compra. Intenta nuevamente.')
      console.error(err)
    } finally {
      setProcesando(false)
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="checkout-loading">
          <p>Cargando cotización...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container">
        <section className="card">
          <div className="checkout-error">
            <h2>⚠️ Error</h2>
            <p>{error}</p>
            <button className="btn-primary" onClick={() => navigate('/catalogo')}>
              Volver al catálogo
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (exito) {
    return (
      <main className="container checkout-success-main">
        <section className="card checkout-success">
          <div className="checkout-success-content">
            <div className="checkout-success-icon">✓</div>
            <h2>¡Compra confirmada!</h2>
            <p className="checkout-success-subtitle">Tu pedido fue procesado correctamente.</p>
            <p className="checkout-success-message">En breve nuestro equipo se va a comunicar con vos para coordinar la entrega.</p>
            <button className="btn-primary" onClick={() => navigate('/catalogo')}>
              Volver al catálogo
            </button>
          </div>
        </section>
      </main>
    )
  }

  const totalProductos = cotizacion?.productos?.reduce((sum, p) => sum + p.cantidad, 0) || 0
  const subtotal = cotizacion?.total || 0
  const costoEnvio = costosEnvio[tipoEnvio] || 0
  const totalFinal = subtotal + costoEnvio

  return (
    <main className="container">
      <section className="card">
        <h1 className="page-title">Checkout</h1>
        <p className="page-subtitle">Completa tu compra</p>
      </section>

      <div className="checkout-layout">
        {/* Columna izquierda: Formulario */}
        <div className="checkout-form">
          {/* ─── A) RESUMEN DEL PEDIDO ─────────────────────────────────── */}
          <section className="card checkout-section">
            <h3 className="checkout-section-title">📦 Resumen del pedido</h3>
            <div className="checkout-products-table-wrap">
              <table className="table checkout-products-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizacion?.productos?.map((producto, idx) => (
                    <tr key={idx}>
                      <td>{producto.nombre}</td>
                      <td>{producto.cantidad}</td>
                      <td>{formatearMoneda(producto.precio_unitario)}</td>
                      <td>{formatearMoneda(producto.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="checkout-total-row">
              <span>Total del pedido:</span>
              <strong>{formatearMoneda(subtotal)}</strong>
            </div>
          </section>

          {/* ─── B) DATOS DE FACTURACIÓN ───────────────────────────────── */}
          <section className="card checkout-section">
            <h3 className="checkout-section-title">📋 Datos de facturación</h3>
            <div className="form-group">
              <label className="label-form" htmlFor="nombre_completo">Nombre completo *</label>
              <input
                id="nombre_completo"
                type="text"
                name="nombre_completo"
                value={formFacturacion.nombre_completo}
                onChange={handleFacturacionChange}
                placeholder="Ej: Juan Pérez"
                className="input-filtro"
              />
            </div>
            <div className="form-group">
              <label className="label-form" htmlFor="cuit_dni">CUIT / DNI *</label>
              <input
                id="cuit_dni"
                type="text"
                name="cuit_dni"
                value={formFacturacion.cuit_dni}
                onChange={handleFacturacionChange}
                placeholder="Ej: 20123456789"
                className="input-filtro"
              />
            </div>
            <div className="form-group">
              <label className="label-form" htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                type="tel"
                name="telefono"
                value={formFacturacion.telefono}
                onChange={handleFacturacionChange}
                placeholder="Ej: +54 11 1234 5678"
                className="input-filtro"
              />
            </div>
            <div className="form-group">
              <label className="label-form" htmlFor="direccion_facturacion">Dirección de facturación *</label>
              <input
                id="direccion_facturacion"
                type="text"
                name="direccion_facturacion"
                value={formFacturacion.direccion_facturacion}
                onChange={handleFacturacionChange}
                placeholder="Ej: Calle Principal 123"
                className="input-filtro"
              />
            </div>
            <div className="form-group">
              <label className="label-form" htmlFor="provincia_facturacion">Provincia *</label>
              <select
                id="provincia_facturacion"
                name="provincia_facturacion"
                value={formFacturacion.provincia_facturacion}
                onChange={handleFacturacionChange}
                className="input-filtro"
              >
                <option value="">Selecciona una provincia</option>
                <option value="Buenos Aires">Buenos Aires</option>
                <option value="CABA">CABA</option>
                <option value="Catamarca">Catamarca</option>
                <option value="Chaco">Chaco</option>
                <option value="Chubut">Chubut</option>
                <option value="Córdoba">Córdoba</option>
                <option value="Corrientes">Corrientes</option>
                <option value="Entre Ríos">Entre Ríos</option>
                <option value="Formosa">Formosa</option>
                <option value="Jujuy">Jujuy</option>
                <option value="La Pampa">La Pampa</option>
                <option value="La Rioja">La Rioja</option>
                <option value="Mendoza">Mendoza</option>
                <option value="Misiones">Misiones</option>
                <option value="Neuquén">Neuquén</option>
                <option value="Río Negro">Río Negro</option>
                <option value="Salta">Salta</option>
                <option value="San Juan">San Juan</option>
                <option value="San Luis">San Luis</option>
                <option value="Santa Cruz">Santa Cruz</option>
                <option value="Santa Fe">Santa Fe</option>
                <option value="Santiago del Estero">Santiago del Estero</option>
                <option value="Tierra del Fuego">Tierra del Fuego</option>
                <option value="Tucumán">Tucumán</option>
              </select>
            </div>
          </section>

          {/* ─── C) MÉTODO DE PAGO ─────────────────────────────────────── */}
          <section className="card checkout-section">
            <h3 className="checkout-section-title">💳 Método de pago</h3>
            <div className="checkout-radio-group">
              <label className="checkout-radio-option">
                <input
                  type="radio"
                  name="metodoPago"
                  value="transferencia"
                  checked={metodoPago === 'transferencia'}
                  onChange={(e) => setMetodoPago(e.target.value)}
                />
                <span className="radio-label">
                  <strong>Transferencia bancaria</strong>
                  <p>Transferencia bancaria directa</p>
                </span>
              </label>
              <label className="checkout-radio-option">
                <input
                  type="radio"
                  name="metodoPago"
                  value="tarjeta"
                  checked={metodoPago === 'tarjeta'}
                  onChange={(e) => setMetodoPago(e.target.value)}
                />
                <span className="radio-label">
                  <strong>Tarjeta de crédito</strong>
                  <p>Visa, Mastercard, Amex</p>
                </span>
              </label>
              <label className="checkout-radio-option">
                <input
                  type="radio"
                  name="metodoPago"
                  value="mercado-pago"
                  checked={metodoPago === 'mercado-pago'}
                  onChange={(e) => setMetodoPago(e.target.value)}
                />
                <span className="radio-label">
                  <strong>Mercado Pago</strong>
                  <p>Wallet y otros medios de pago</p>
                </span>
              </label>
            </div>

            {/* Campos de tarjeta solo si está seleccionado */}
            {metodoPago === 'tarjeta' && (
              <div className="checkout-tarjeta-fields">
                <div className="form-group">
                  <label className="label-form" htmlFor="numero">Número de tarjeta *</label>
                  <input
                    id="numero"
                    type="text"
                    name="numero"
                    value={datosTarjeta.numero}
                    onChange={handleTarjetaChange}
                    placeholder="0000 0000 0000 0000"
                    className="input-filtro"
                    maxLength="19"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="label-form" htmlFor="vencimiento">Vencimiento *</label>
                    <input
                      id="vencimiento"
                      type="text"
                      name="vencimiento"
                      value={datosTarjeta.vencimiento}
                      onChange={handleTarjetaChange}
                      placeholder="MM/YY"
                      className="input-filtro"
                      maxLength="5"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label-form" htmlFor="cvv">CVV *</label>
                    <input
                      id="cvv"
                      type="text"
                      name="cvv"
                      value={datosTarjeta.cvv}
                      onChange={handleTarjetaChange}
                      placeholder="123"
                      className="input-filtro"
                      maxLength="4"
                    />
                  </div>
                </div>
              </div>
            )}

            {metodoPago === 'mercado-pago' && (
              <div style={{ padding: '16px', backgroundColor: '#f0f0f0', borderRadius: '8px', marginTop: '12px' }}>
                <p style={{ margin: 0, textAlign: 'center', color: '#666' }}>
                  Serás redirigido a Mercado Pago al confirmar tu compra.
                </p>
              </div>
            )}
          </section>

          {/* ─── D) DATOS DE ENVÍO ─────────────────────────────────────── */}
          <section className="card checkout-section">
            <h3 className="checkout-section-title">🚚 Datos de envío</h3>
            <label className="checkout-checkbox">
              <input
                type="checkbox"
                checked={mismaFacturacion}
                onChange={(e) => setMismaFacturacion(e.target.checked)}
              />
              <span>Es la misma dirección que la de facturación</span>
            </label>

            {!mismaFacturacion && (
              <>
                <div className="form-group">
                  <label className="label-form" htmlFor="direccion_envio">Dirección de envío *</label>
                  <input
                    id="direccion_envio"
                    type="text"
                    name="direccion_envio"
                    value={formEnvio.direccion_envio}
                    onChange={handleEnvioChange}
                    placeholder="Ej: Calle Secundaria 456"
                    className="input-filtro"
                  />
                </div>
                <div className="form-group">
                  <label className="label-form" htmlFor="ciudad">Ciudad *</label>
                  <input
                    id="ciudad"
                    type="text"
                    name="ciudad"
                    value={formEnvio.ciudad}
                    onChange={handleEnvioChange}
                    placeholder="Ej: Buenos Aires"
                    className="input-filtro"
                  />
                </div>
                <div className="form-group">
                  <label className="label-form" htmlFor="codigo_postal">Código postal *</label>
                  <input
                    id="codigo_postal"
                    type="text"
                    name="codigo_postal"
                    value={formEnvio.codigo_postal}
                    onChange={handleEnvioChange}
                    placeholder="Ej: 1425"
                    className="input-filtro"
                  />
                </div>
                <div className="form-group">
                  <label className="label-form" htmlFor="provincia_envio">Provincia *</label>
                  <select
                    id="provincia_envio"
                    name="provincia_envio"
                    value={formEnvio.provincia_envio}
                    onChange={handleEnvioChange}
                    className="input-filtro"
                  >
                    <option value="">Selecciona una provincia</option>
                    <option value="Buenos Aires">Buenos Aires</option>
                    <option value="CABA">CABA</option>
                    <option value="Catamarca">Catamarca</option>
                    <option value="Chaco">Chaco</option>
                    <option value="Chubut">Chubut</option>
                    <option value="Córdoba">Córdoba</option>
                    <option value="Corrientes">Corrientes</option>
                    <option value="Entre Ríos">Entre Ríos</option>
                    <option value="Formosa">Formosa</option>
                    <option value="Jujuy">Jujuy</option>
                    <option value="La Pampa">La Pampa</option>
                    <option value="La Rioja">La Rioja</option>
                    <option value="Mendoza">Mendoza</option>
                    <option value="Misiones">Misiones</option>
                    <option value="Neuquén">Neuquén</option>
                    <option value="Río Negro">Río Negro</option>
                    <option value="Salta">Salta</option>
                    <option value="San Juan">San Juan</option>
                    <option value="San Luis">San Luis</option>
                    <option value="Santa Cruz">Santa Cruz</option>
                    <option value="Santa Fe">Santa Fe</option>
                    <option value="Santiago del Estero">Santiago del Estero</option>
                    <option value="Tierra del Fuego">Tierra del Fuego</option>
                    <option value="Tucumán">Tucumán</option>
                  </select>
                </div>
              </>
            )}
          </section>

          {/* ─── E) TIPO DE ENVÍO ──────────────────────────────────────── */}
          <section className="card checkout-section">
            <h3 className="checkout-section-title">📍 Tipo de envío</h3>
            <div className="checkout-radio-group">
              <label className="checkout-radio-option">
                <input
                  type="radio"
                  name="tipoEnvio"
                  value="correo-argentino"
                  checked={tipoEnvio === 'correo-argentino'}
                  onChange={(e) => setTipoEnvio(e.target.value)}
                />
                <span className="radio-label">
                  <strong>Correo Argentino</strong>
                  <p>Envío estándar (5-7 días hábiles) — Gratis</p>
                </span>
              </label>
              <label className="checkout-radio-option">
                <input
                  type="radio"
                  name="tipoEnvio"
                  value="andreani"
                  checked={tipoEnvio === 'andreani'}
                  onChange={(e) => setTipoEnvio(e.target.value)}
                />
                <span className="radio-label">
                  <strong>Andreani</strong>
                  <p>Envío prioritario (2-3 días hábiles) — {formatearMoneda(3500)}</p>
                </span>
              </label>
              <label className="checkout-radio-option">
                <input
                  type="radio"
                  name="tipoEnvio"
                  value="retiro-sucursal"
                  checked={tipoEnvio === 'retiro-sucursal'}
                  onChange={(e) => setTipoEnvio(e.target.value)}
                />
                <span className="radio-label">
                  <strong>Retiro en sucursal</strong>
                  <p>Sin costo — Coordinar retiro</p>
                </span>
              </label>
            </div>
          </section>
        </div>

        {/* Columna derecha: Resumen */}
        <aside className="checkout-sidebar">
          <section className="card checkout-summary">
            <h3 className="checkout-summary-title">Resumen de compra</h3>

            <div className="checkout-summary-row">
              <span>Subtotal:</span>
              <span>{formatearMoneda(subtotal)}</span>
            </div>

            <div className="checkout-summary-row">
              <span>Envío:</span>
              <span>{formatearMoneda(costoEnvio)}</span>
            </div>

            <div className="checkout-summary-divider"></div>

            <div className="checkout-summary-total">
              <span>Total:</span>
              <strong>{formatearMoneda(totalFinal)}</strong>
            </div>

            <button
              className="btn-primary btn-full"
              onClick={handleConfirmar}
              disabled={procesando}
            >
              {procesando ? 'Procesando...' : 'Confirmar compra'}
            </button>

            <p className="checkout-summary-disclaimer">
              Al confirmar, aceptas nuestros términos y condiciones.
            </p>
          </section>
        </aside>
      </div>
    </main>
  )
}
