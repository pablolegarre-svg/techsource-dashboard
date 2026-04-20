import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import Table from '../components/Table'
import Pagination, { paginate } from '../components/Pagination'
import { formatearFecha } from '../utils/helpers'

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    async function cargar() {
      const [{ data: prov }, { data: cat }] = await Promise.all([
        supabase.from('proveedores').select('*').order('nombre', { ascending: true }),
        supabase.from('vista_catalogo_proveedores').select('idproveedor, vigente'),
      ])
      setProveedores(prov || [])
      setCatalogo(cat || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return proveedores
    const q = busqueda.toLowerCase()
    return proveedores.filter((p) =>
      p.nombre?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    )
  }, [proveedores, busqueda])

  const paginated = paginate(filtrados, page, pageSize)

  function productosDeProveedor(idproveedor) {
    return catalogo.filter((c) => c.idproveedor === idproveedor)
  }

  const columns = [
    {
      key: 'nombre',
      label: 'Proveedor',
      render: (r) => <strong style={{ color: '#1d315d' }}>{r.nombre}</strong>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (r) => r.email || <span style={{ color: '#b0baca' }}>—</span>,
    },
    {
      key: 'productos',
      label: 'Productos',
      render: (r) => {
        const prods = productosDeProveedor(r.idproveedor)
        const vigentes = prods.filter((p) => p.vigente).length
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="badge badge-blue">{vigentes} vigentes</span>
            {prods.length - vigentes > 0 && (
              <span className="badge badge-gray">{prods.length - vigentes} inactivos</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'detalles',
      label: 'Detalles',
      render: (r) => r.detalles
        ? <span style={{ fontSize: '0.83rem', color: '#6b7c98' }}>{r.detalles}</span>
        : <span style={{ color: '#b0baca' }}>—</span>,
    },
    {
      key: 'creado',
      label: 'Alta',
      render: (r) => <span style={{ fontSize: '0.83rem', color: '#9aaabf' }}>{formatearFecha(r.creado)}</span>,
    },
  ]

  return (
    <main className="container">
      <section className="card" style={{ marginBottom: 14 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="page-title">Proveedores</h1>
            <p className="page-subtitle">{proveedores.length} proveedor(es) registrados</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div style={{ marginBottom: 14 }}>
          <input
            className="input-filtro"
            placeholder="Buscar por proveedor o email..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
          />
        </div>

        <Table
          columns={columns}
          data={paginated}
          loading={loading}
          emptyMessage="No hay proveedores registrados."
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtrados.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          label="proveedores"
        />
      </section>
    </main>
  )
}
