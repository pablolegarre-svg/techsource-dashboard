import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import Table from '../components/Table'
import Pagination, { paginate } from '../components/Pagination'
import Modal from '../components/Modal'

const CAT_ICONS = {
  Laptops: '💻', Monitores: '🖥️', Memorias: '💾',
  Periféricos: '🖱️', USB: '🔌', Tablets: '📱',
  Almacenamiento: '🗄️', Smartphones: '📱',
}

export default function CatalogoPublico() {
  const [catalogo, setCatalogo] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [categoria, setCategoria] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [seleccionado, setSeleccionado] = useState(null)
  const [imgError, setImgError] = useState(false)
  const [sortBy, setSortBy] = useState('nombre')
  const featuredRef = useRef(null)

  useEffect(() => {
    supabase
      .from('vista_catalogo_proveedores')
      .select('id,sku,nombre,descripcion,categoria,precio_venta,moneda,proveedor,stock,vigente,imagen_url,fecha_sync')
      .eq('vigente', true)
      .order('nombre', { ascending: true })
      .then(({ data }) => { setCatalogo(data || []); setLoading(false) })
  }, [])

  const categorias = useMemo(() =>
    [...new Set(catalogo.map(x => x.categoria?.trim()).filter(Boolean))].sort(), [catalogo])

  const marcas = useMemo(() =>
    [...new Set(catalogo.map(x => x.proveedor).filter(Boolean))], [catalogo])

  const ultimaSync = useMemo(() => {
    const fechas = catalogo.map(x => x.fecha_sync).filter(Boolean)
    if (!fechas.length) return null
    return new Date(Math.max(...fechas.map(f => new Date(f).getTime())))
  }, [catalogo])

  const filtrado = useMemo(() => {
    const q = busqueda.toLowerCase()
    let result = catalogo.filter(item => {
      const ok = !q ||
        (item.nombre || '').toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        (item.categoria || '').toLowerCase().includes(q)
      return ok && (!categoria || (item.categoria?.trim() ?? '') === categoria)
    })
    if (sortBy === 'precio-asc') return [...result].sort((a, b) => (a.precio_venta || 0) - (b.precio_venta || 0))
    if (sortBy === 'precio-desc') return [...result].sort((a, b) => (b.precio_venta || 0) - (a.precio_venta || 0))
    return result
  }, [catalogo, busqueda, categoria, sortBy])

  const paginated = paginate(filtrado, page, pageSize)
  const destacados = useMemo(() => catalogo.filter(p => p.imagen_url).slice(0, 4), [catalogo])

  const aplicar = () => { setBusqueda(inputVal); setPage(1) }

  const columns = [
    { key: 'sku', label: 'SKU' },
    {
      key: 'nombre', label: 'Producto',
      render: r => (
        <div className="producto-cell">
          {r.imagen_url && (
            <img src={r.imagen_url} alt="" className="producto-thumb"
              onError={e => { e.target.style.display = 'none' }} />
          )}
          <span>{r.nombre}</span>
        </div>
      )
    },
    { key: 'categoria', label: 'Categoría', render: r => <span className="badge badge-blue">{r.categoria}</span> },
    { key: 'precio_venta', label: 'Precio', render: r => `${r.moneda ?? 'USD'} ${r.precio_venta?.toFixed(0) ?? ''}` },
    {
      key: 'stock', label: 'Disponibilidad',
      render: r => (
        <span className={`badge ${r.stock > 0 ? 'badge-green' : 'badge-red'}`}>
          {r.stock > 0 ? 'En stock' : 'Sin stock'}
        </span>
      )
    },
    {
      key: '_cta', label: 'Acciones',
      render: () => <Link to="/cotizar" className="btn-cta-table">Solicitar Cotización</Link>
    },
  ]

  return (
    <main className="container catalogo-page">

      {/* BANNER */}
      <section className="catalogo-banner">
        <div className="catalogo-banner-left">

          <div className="catalogo-badge">
            <span className="catalogo-badge-dot" />
            Catálogo actualizado
          </div>

          <h1 className="catalogo-banner-title">Catálogo de Productos</h1>
          <p className="catalogo-banner-subtitle">
            Explora nuestra oferta y solicita una cotización personalizada
          </p>

          <div className="catalogo-search-row">
            <div className="catalogo-search-wrap">
              <svg className="catalogo-search-icon-svg" viewBox="0 0 20 20" fill="none">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                className="catalogo-search-input"
                placeholder="Buscar productos por nombre, SKU o categoría..."
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && aplicar()}
              />
            </div>
            <button className="catalogo-search-btn" onClick={aplicar}>
              <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Buscar
            </button>
          </div>

          <div className="catalogo-pills">
            {['', ...categorias].map(c => (
              <button
                key={c || '__todas'}
                className={`catalogo-pill${categoria === c ? ' active' : ''}`}
                onClick={() => { setCategoria(c); setPage(1) }}
              >
                {c ? (CAT_ICONS[c] ? CAT_ICONS[c] + ' ' : '') : '⊞ '}{c || 'Todos'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="catalogo-stats">
        <div className="catalogo-stat-card">
          <div className="catalogo-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="22" height="22">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            </svg>
          </div>
          <div>
            <p className="catalogo-stat-label">Productos disponibles</p>
            <h3 className="catalogo-stat-value">{catalogo.length}</h3>
            <p className="catalogo-stat-sub">Total en catálogo</p>
          </div>
        </div>

        <div className="catalogo-stat-card">
          <div className="catalogo-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="22" height="22">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </div>
          <div>
            <p className="catalogo-stat-label">Categorías</p>
            <h3 className="catalogo-stat-value">{categorias.length}</h3>
            <p className="catalogo-stat-sub">Líneas de productos</p>
          </div>
        </div>

        <div className="catalogo-stat-card">
          <div className="catalogo-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="22" height="22">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <p className="catalogo-stat-label">Marcas líderes</p>
            <h3 className="catalogo-stat-value">{marcas.length}</h3>
            <p className="catalogo-stat-sub">Marcas disponibles</p>
          </div>
        </div>

        <div className="catalogo-stat-card">
          <div className="catalogo-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="22" height="22">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="catalogo-stat-label">Última actualización</p>
            <h3 className="catalogo-stat-value catalogo-stat-date">
              {ultimaSync ? ultimaSync.toLocaleDateString('es-AR') : '—'}
            </h3>
            <p className="catalogo-stat-sub">
              {ultimaSync
                ? ultimaSync.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* PRODUCTOS DESTACADOS */}
      {destacados.length > 0 && (
        <section className="card catalogo-featured">
          <div className="card-header">
            <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="1.8" width="18" height="18">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Productos destacados
            </h2>
          </div>
          <div className="featured-scroll-wrap">
            <div className="featured-scroll" ref={featuredRef}>
              {destacados.map(p => (
                <div key={p.id} className="featured-card"
                  onClick={() => { setSeleccionado(p); setImgError(false) }}>
                  <img src={p.imagen_url} alt={p.nombre} className="featured-card-img"
                    onError={e => { e.target.style.display = 'none' }} />
                  <div className="featured-card-body">
                    <span className="badge badge-blue featured-card-badge">{p.categoria}</span>
                    <p className="featured-card-name">{p.nombre}</p>
                    <p className="featured-card-sku">{p.sku}</p>
                    <p className="featured-card-price">USD {p.precio_venta?.toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CATÁLOGO COMPLETO */}
      <section className="card">
        <div className="catalogo-table-header">
          <h2 className="section-title" style={{ margin: 0 }}>Catálogo completo</h2>
          <div className="catalogo-table-actions">
            <button className="btn-export">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="15" height="15">
                <path d="M13 8l-3 3-3-3M10 11V3M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
              </svg>
              Exportar
            </button>
            <select className="input-filtro select-sort" value={sortBy}
              onChange={e => setSortBy(e.target.value)}>
              <option value="nombre">Ordenar por: Nombre (A-Z)</option>
              <option value="precio-asc">Precio (menor a mayor)</option>
              <option value="precio-desc">Precio (mayor a menor)</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 10, color: '#6b7c98', fontSize: '0.88rem' }}>
          {filtrado.length} de {catalogo.length} productos
        </div>
        <Table
          columns={columns}
          data={paginated}
          loading={loading}
          emptyMessage="No se encontraron productos."
          onRowClick={p => { setSeleccionado(p); setImgError(false) }}
        />
        <Pagination page={page} pageSize={pageSize} total={filtrado.length}
          onPageChange={setPage}
          onPageSizeChange={s => { setPageSize(s); setPage(1) }}
          label="productos" />
      </section>

      {/* MODAL DETALLE */}
      {seleccionado && (
        <Modal title={seleccionado.nombre} onClose={() => setSeleccionado(null)} maxWidth={520}>
          <div className="producto-modal-body">
            {seleccionado.imagen_url && !imgError && (
              <img src={seleccionado.imagen_url} alt={seleccionado.nombre}
                className="producto-modal-img" onError={() => setImgError(true)} />
            )}
            <div className="producto-modal-meta">
              <span className="badge badge-blue">{seleccionado.categoria}</span>
              <span className="producto-modal-precio">
                {seleccionado.moneda} {seleccionado.precio_venta?.toFixed(0)}
              </span>
            </div>
            {seleccionado.descripcion && (
              <p className="producto-modal-desc">{seleccionado.descripcion}</p>
            )}
            <div className="producto-modal-info">
              <span>SKU: <strong>{seleccionado.sku}</strong></span>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}
