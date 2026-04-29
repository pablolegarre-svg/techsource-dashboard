import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import Table from '../components/Table'
import Pagination, { paginate } from '../components/Pagination'
import ErrorState from '../components/ErrorState'

export default function Catalogo() {
  const [catalogo, setCatalogo] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [seleccionado, setSeleccionado] = useState(null)
  const [imgError, setImgError] = useState(false)
  const [confirmando, setConfirmando] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    setError(null)
    const [{ data: productos, error: e1 }, { data: reservas }] = await Promise.all([
      supabase.from('catalogo_proveedores').select('*').order('nombre', { ascending: true }),
      supabase.from('stock_control').select('catalogo_id, stock_reservado').then((r) => r.error ? { data: [] } : r),
    ])
    if (e1) { setError(e1.message); setLoading(false); return }
    const reservasPorProducto = {}
    for (const r of (reservas || [])) {
      const key = String(r.catalogo_id)
      reservasPorProducto[key] = (reservasPorProducto[key] || 0) + r.stock_reservado
    }
    const merged = (productos || []).map((p) => {
      const reservado = reservasPorProducto[String(p.id)] || 0
      return { ...p, stock_reservado: reservado, stock_disponible: p.stock - reservado }
    })
    setCatalogo(merged)
    setLoading(false)
  }

  const categorias = useMemo(() => [...new Set(catalogo.map((x) => x.categoria).filter(Boolean))].sort(), [catalogo])
  const proveedores = useMemo(() => [...new Set(catalogo.map((x) => x.proveedor).filter(Boolean))].sort(), [catalogo])

  const filtrado = useMemo(() => {
    return catalogo.filter((item) => {
      const q = busqueda.toLowerCase()
      const cumpleTexto = !busqueda ||
        (item.nombre || '').toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        (item.proveedor || '').toLowerCase().includes(q)
      const cumpleCategoria = !categoria || item.categoria === categoria
      const cumpleProveedor = !proveedor || item.proveedor === proveedor
      return cumpleTexto && cumpleCategoria && cumpleProveedor
    })
  }, [catalogo, busqueda, categoria, proveedor])

  const paginated = paginate(filtrado, page, pageSize)

  function pedirConfirmacion(e, item) {
    e.stopPropagation()
    setConfirmando(item)
  }

  async function confirmarToggle() {
    const item = confirmando
    const nuevoValor = !item.vigente
    setConfirmando(null)
    await supabase.from('catalogo_proveedores').update({ vigente: nuevoValor }).eq('id', item.id)
    setCatalogo((prev) => prev.map((p) => p.id === item.id ? { ...p, vigente: nuevoValor } : p))
    if (seleccionado?.id === item.id) setSeleccionado((s) => ({ ...s, vigente: nuevoValor }))
  }

  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'categoria', label: 'Categoría', render: (r) => <span className="badge badge-blue-soft">{r.categoria}</span> },
    { key: 'precio', label: 'Precio costo', render: (r) => `${r.moneda ?? ''} ${r.precio != null ? Number(r.precio).toFixed(0) : '—'}` },
    { key: 'precio_venta', label: 'Precio venta', render: (r) => `${r.moneda ?? ''} ${r.precio_venta != null ? Number(r.precio_venta).toFixed(0) : '—'}` },
    { key: 'proveedor', label: 'Proveedor' },
    { key: 'stock', label: 'Stock Total', render: (r) => <span style={{ display: 'block', textAlign: 'center' }}>{r.stock}</span> },
    { key: 'stock_reservado', label: 'Reservado', render: (r) => (
      <span style={{ display: 'block', textAlign: 'center', color: r.stock_reservado > 0 ? '#b42318' : '#9aaabf' }}>
        {r.stock_reservado}
      </span>
    )},
    { key: 'stock_disponible', label: 'Disponible', render: (r) => (
      <span style={{ display: 'block', textAlign: 'center', fontWeight: 600, color: r.stock_disponible > 0 ? '#177d48' : '#b42318' }}>
        {r.stock_disponible}
      </span>
    )},
    { key: 'fecha_sync', label: 'Última Sync', render: (r) => r.fecha_sync ? new Date(r.fecha_sync).toLocaleString() : '' },
    {
      key: 'vigente', label: 'Vigente',
      render: (r) => (
        <button
          onClick={(e) => pedirConfirmacion(e, r)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.78rem', fontFamily: 'Inter, sans-serif',
            background: r.vigente ? '#d7f3e3' : '#fde2e1',
            color: r.vigente ? '#177d48' : '#b42318',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.vigente ? '#177d48' : '#b42318', flexShrink: 0 }} />
          {r.vigente ? 'Vigente' : 'Inactivo'}
        </button>
      ),
    },
  ]

  if (error) return <ErrorState mensaje={error} onRetry={cargar} />

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo</h1>
          <p className="page-subtitle">{filtrado.length} de {catalogo.length} productos</p>
        </div>
      </div>

      <div className="card filters-card" style={{ marginBottom: 14 }}>
        <div className="filtros-grid">
          <input className="input-filtro" placeholder="Buscar por nombre..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1) }} />
          <select className="input-filtro" value={categoria} onChange={(e) => { setCategoria(e.target.value); setPage(1) }}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input-filtro" value={proveedor} onChange={(e) => { setProveedor(e.target.value); setPage(1) }}>
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={paginated}
          loading={loading}
          emptyMessage="No se encontraron productos."
          onRowClick={(p) => { setSeleccionado(p); setImgError(false) }}
        />
        <Pagination page={page} pageSize={pageSize} total={filtrado.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} label="productos" />
      </div>

      {seleccionado && (
        <div className="modal-backdrop" onClick={() => setSeleccionado(null)}>
          <div className="prod-admin-modal" onClick={(e) => e.stopPropagation()}>

            {/* Imagen */}
            <div className="prod-admin-modal-img-wrap">
              {seleccionado.imagen_url && !imgError
                ? <img src={seleccionado.imagen_url} alt={seleccionado.nombre} onError={() => setImgError(true)} />
                : <div className="prod-admin-modal-img-placeholder">📦</div>
              }
              <button className="prod-admin-modal-close" onClick={() => setSeleccionado(null)}>✕</button>
            </div>

            {/* Info */}
            <div className="prod-admin-modal-body">
              <div>
                <h2 className="prod-admin-modal-title">{seleccionado.nombre}</h2>
                <p className="prod-admin-modal-sku">{seleccionado.sku}</p>
              </div>

              {seleccionado.descripcion && (
                <p className="prod-admin-modal-desc">{seleccionado.descripcion}</p>
              )}

              <div className="prod-admin-modal-rows">
                <div className="prod-admin-modal-row">
                  <span>Precio costo</span>
                  <strong>{seleccionado.moneda} {Number(seleccionado.precio).toLocaleString()}</strong>
                </div>
                <div className="prod-admin-modal-row">
                  <span>Precio venta</span>
                  <strong>{seleccionado.moneda} {Number(seleccionado.precio_venta).toLocaleString()}</strong>
                </div>
                <div className="prod-admin-modal-row">
                  <span>Stock total</span>
                  <strong>{seleccionado.stock} unidades</strong>
                </div>
                <div className="prod-admin-modal-row">
                  <span>Reservado</span>
                  <strong style={{ color: seleccionado.stock_reservado > 0 ? '#b42318' : '#6b7c98' }}>
                    {seleccionado.stock_reservado || 0} unidades
                  </strong>
                </div>
                <div className="prod-admin-modal-row">
                  <span>Disponible</span>
                  <strong style={{ color: seleccionado.stock_disponible > 0 ? '#177d48' : '#b42318' }}>
                    {seleccionado.stock_disponible ?? seleccionado.stock} unidades
                  </strong>
                </div>
                <div className="prod-admin-modal-row">
                  <span>Proveedor</span>
                  <strong>{seleccionado.proveedor}</strong>
                </div>
                <div className="prod-admin-modal-row">
                  <span>Estado</span>
                  <button
                    onClick={(e) => pedirConfirmacion(e, seleccionado)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.78rem', fontFamily: 'Inter, sans-serif',
                      background: seleccionado.vigente ? '#d7f3e3' : '#fde2e1',
                      color: seleccionado.vigente ? '#177d48' : '#b42318',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: seleccionado.vigente ? '#177d48' : '#b42318', flexShrink: 0 }} />
                    {seleccionado.vigente ? 'Vigente' : 'Inactivo'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {confirmando && (
        <div className="modal-backdrop" onClick={() => setConfirmando(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-modal-msg">
              {confirmando.vigente
                ? <>¿Deseas <strong>desactivar</strong> "{confirmando.nombre}"?</>
                : <>¿Deseas <strong>activar</strong> "{confirmando.nombre}"?</>
              }
            </p>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-cancel" onClick={() => setConfirmando(null)}>Cancelar</button>
              <button
                className="confirm-modal-ok"
                style={{ background: confirmando.vigente ? '#b42318' : '#177d48' }}
                onClick={confirmarToggle}
              >
                {confirmando.vigente ? 'Sí, desactivar' : 'Sí, activar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
