import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const POSICIONES = [1, 2, 3, 4]

function TarjetaDestacado({ posicion, actual, onGuardar }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const wrapRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function buscar(q) {
    setQuery(q)
    clearTimeout(timerRef.current)
    if (!q.trim()) { setResultados([]); setAbierto(false); return }
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      const { data } = await supabase
        .from('vista_catalogo_proveedores')
        .select('id,sku,nombre,categoria,precio_venta,imagen_url')
        .eq('vigente', true)
        .or(`nombre.ilike.%${q}%,sku.ilike.%${q}%,categoria.ilike.%${q}%`)
        .limit(8)
      setResultados(data || [])
      setAbierto(true)
      setBuscando(false)
    }, 280)
  }

  async function seleccionar(producto) {
    setAbierto(false)
    setQuery('')
    setResultados([])
    setGuardando(true)
    const payload = {
      posicion,
      producto_id: producto.id,
      sku: producto.sku,
      nombre: producto.nombre,
      categoria: producto.categoria,
      precio_venta: producto.precio_venta,
      imagen_url: producto.imagen_url ?? null,
    }
    const { error } = await supabase
      .from('productos_destacados')
      .upsert(payload, { onConflict: 'posicion' })
    setGuardando(false)
    if (!error) onGuardar(posicion, payload)
  }

  return (
    <div className="destacado-card">
      <div className="destacado-card-header">
        <span className="destacado-pos-badge">Posición {posicion}</span>
        {actual && (
          <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Activo</span>
        )}
      </div>

      {actual ? (
        <div className="destacado-producto-actual">
          {actual.imagen_url
            ? <img src={actual.imagen_url} alt={actual.nombre} className="destacado-img"
                onError={e => { e.target.style.display = 'none' }} />
            : <div className="destacado-img-placeholder" />
          }
          <div className="destacado-producto-info">
            <span className="badge badge-blue" style={{ fontSize: '0.68rem', marginBottom: 4 }}>{actual.categoria}</span>
            <p className="destacado-nombre">{actual.nombre}</p>
            <p className="destacado-sku">{actual.sku}</p>
            <p className="destacado-precio">USD {actual.precio_venta?.toFixed(0)}</p>
          </div>
        </div>
      ) : (
        <div className="destacado-vacio">
          <svg viewBox="0 0 24 24" fill="none" stroke="#c0ccdf" strokeWidth="1.4" width="32" height="32">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <p>Sin producto asignado</p>
        </div>
      )}

      <div className="destacado-search-wrap" ref={wrapRef}>
        <div className="destacado-search-row">
          <svg viewBox="0 0 20 20" fill="none" width="14" height="14" style={{ flexShrink: 0, color: '#8a9bb8' }}>
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            className="destacado-search-input"
            placeholder={actual ? 'Cambiar producto...' : 'Buscar producto...'}
            value={query}
            onChange={e => buscar(e.target.value)}
            onFocus={() => resultados.length && setAbierto(true)}
          />
          {buscando && <span className="destacado-spinner" />}
        </div>

        {abierto && resultados.length > 0 && (
          <ul className="destacado-dropdown">
            {resultados.map(p => (
              <li key={p.id} className="destacado-dropdown-item" onClick={() => seleccionar(p)}>
                {p.imagen_url && (
                  <img src={p.imagen_url} alt="" className="destacado-dropdown-img"
                    onError={e => { e.target.style.display = 'none' }} />
                )}
                <div className="destacado-dropdown-info">
                  <span className="destacado-dropdown-nombre">{p.nombre}</span>
                  <span className="destacado-dropdown-meta">{p.sku} · {p.categoria} · USD {p.precio_venta?.toFixed(0)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {guardando && (
        <p className="destacado-guardando">Guardando...</p>
      )}
    </div>
  )
}

export default function Destacados() {
  const [actuales, setActuales] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('productos_destacados')
      .select('posicion,producto_id,sku,nombre,categoria,precio_venta,imagen_url')
      .order('posicion')
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(r => { map[r.posicion] = r })
        setActuales(map)
        setLoading(false)
      })
  }, [])

  function handleGuardar(posicion, payload) {
    setActuales(prev => ({ ...prev, [posicion]: payload }))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Productos destacados</h1>
          <p className="page-subtitle">Seleccioná los 4 productos que aparecen en la sección destacada del catálogo público.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#8a9bb8', fontSize: '0.88rem' }}>Cargando...</p>
      ) : (
        <div className="destacados-grid">
          {POSICIONES.map(pos => (
            <TarjetaDestacado
              key={pos}
              posicion={pos}
              actual={actuales[pos] ?? null}
              onGuardar={handleGuardar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
