import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import LineChart from '../components/LineChart'
import Table from '../components/Table'
import Pagination, { paginate } from '../components/Pagination'
import ErrorState from '../components/ErrorState'

export default function Historial() {
  const [historial, setHistorial] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [producto, setProducto] = useState('')
  const [productoSeleccionado, setProductoSeleccionado] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    setError(null)
    const [{ data: hist, error: e1 }, { data: cat, error: e2 }] = await Promise.all([
      supabase.from('historial_precios').select('*').order('fecha_cambio', { ascending: true }),
      supabase.from('vista_catalogo_proveedores').select('sku,nombre,categoria,proveedor,source,fecha_sync'),
    ])
    if (e1 || e2) { setError((e1 || e2).message); setLoading(false); return }
    setHistorial(hist || [])
    setCatalogo(cat || [])
    setLoading(false)
  }

  const categorias = useMemo(() => [...new Set(catalogo.map((x) => x.categoria).filter(Boolean))].sort(), [catalogo])
  const productos = useMemo(() => [...new Set(historial.map((x) => x.nombre).filter(Boolean))].sort(), [historial])

  const filtrado = useMemo(() => {
    return historial.filter((item) => {
      const meta = catalogo.find((c) => c.sku === item.sku)
      const cumpleTexto = !busqueda || (item.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
      const cumpleCategoria = !categoria || (meta?.categoria || '') === categoria
      const cumpleProducto = !producto || item.nombre === producto
      return cumpleTexto && cumpleCategoria && cumpleProducto
    })
  }, [historial, catalogo, busqueda, categoria, producto])

  const productosEnFiltrado = useMemo(() => {
    return [...new Set(
      filtrado.map((x) => {
        const meta = catalogo.find((c) => c.sku === x.sku)
        return x.nombre || meta?.nombre || null
      }).filter(Boolean)
    )].sort()
  }, [filtrado, catalogo])

  useEffect(() => {
    setProductoSeleccionado('')
    setPage(1)
  }, [busqueda, categoria, producto])

  const resolverNombre = (r) => {
    const meta = catalogo.find((c) => c.sku === r.sku)
    return r.nombre || meta?.nombre || ''
  }

  const chartData = useMemo(() => {
  const nombreChart =
    productosEnFiltrado.length === 1
      ? productosEnFiltrado[0]
      : productoSeleccionado

  if (!nombreChart) return []

  const registros = filtrado.filter((r) => resolverNombre(r) === nombreChart)

  if (registros.length === 0) return []

  // Primer punto: precio_anterior del registro más antiguo
  const puntos = [
    {
      x: new Date(registros[0].fecha_cambio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
      y: Number(registros[0].precio_anterior),
    },
    ...registros.map((r) => ({
      x: new Date(r.fecha_cambio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
      y: Number(r.precio_nuevo),
    }))
  ]

  return puntos
}, [filtrado, catalogo, productosEnFiltrado, productoSeleccionado])
  const tablaData = useMemo(() => {
    const base = [...filtrado].reverse()
    if (productosEnFiltrado.length > 1 && productoSeleccionado) {
      return base.filter((r) => resolverNombre(r) === productoSeleccionado)
    }
    return base
  }, [filtrado, catalogo, productosEnFiltrado, productoSeleccionado])

  const paginated = paginate(tablaData, page, pageSize)

  const contadorRegistros = productosEnFiltrado.length > 1 && productoSeleccionado
    ? tablaData.length
    : filtrado.length

  const columns = [
    { key: 'nombre', label: 'Producto' },
    {
      key: 'proveedor',
      label: 'Proveedor',
      render: (r) => <span className="badge badge-gray">{r.proveedor || 'Proveedor_Mockaroo'}</span>,
    },
    {
      key: 'precio_anterior',
      label: 'Anterior',
      render: (r) => `$${Number(r.precio_anterior).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'precio_nuevo',
      label: 'Nuevo',
      render: (r) => <strong>${Number(r.precio_nuevo).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>,
    },
    {
      key: 'cambio',
      label: 'Cambio',
      render: (r) => {
        const diff = Number(r.precio_nuevo) - Number(r.precio_anterior)
        const pct = Number(r.precio_anterior) !== 0 ? (diff / Number(r.precio_anterior)) * 100 : 0
        const sube = diff >= 0
        return (
          <span style={{ color: sube ? '#16a34a' : '#dc2626', fontWeight: 800 }}>
            {sube ? '↗' : '↘'} {pct.toFixed(1)}%
          </span>
        )
      },
    },
    {
      key: 'fecha_cambio',
      label: 'Fecha',
      render: (r) => (r.fecha_cambio ? new Date(r.fecha_cambio).toLocaleString('es-CO') : ''),
    },
  ]

  if (error) return <ErrorState mensaje={error} onRetry={cargar} />

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Historial de Precios</h1>
          <p className="page-subtitle">Registro de cambios ({contadorRegistros})</p>
        </div>
      </div>

      <div className="card filters-card" style={{ marginBottom: 14 }}>
        <div className="filtros-grid">
          <input
            className="input-filtro"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
          />
          <select
            className="input-filtro"
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setPage(1) }}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="input-filtro"
            value={producto}
            onChange={(e) => { setProducto(e.target.value); setPage(1) }}
          >
            <option value="">Todos los productos</option>
            {productos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="card historial-chart-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>Evolución de precios</h2>
          {productosEnFiltrado.length > 1 && (
            <select
              className="input-filtro"
              value={productoSeleccionado}
              onChange={(e) => { setProductoSeleccionado(e.target.value); setPage(1) }}
              style={{ maxWidth: 320 }}
            >
              <option value="">Seleccioná un producto...</option>
              {productosEnFiltrado.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
        {chartData.length > 0 ? (
          <LineChart data={chartData} height={260} />
        ) : (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>
            {productosEnFiltrado.length > 1
              ? 'Seleccioná un producto para ver la evolución de precios'
              : 'No hay datos para mostrar'}
          </p>
        )}
      </div>

      <div className="card">
        <Table columns={columns} data={paginated} loading={loading} emptyMessage="No se encontraron registros." />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={tablaData.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          label="registros"
        />
      </div>
    </div>
  )
}