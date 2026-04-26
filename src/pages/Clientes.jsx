import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import Table from '../components/Table'
import Pagination, { paginate } from '../components/Pagination'
import ClientModal from '../components/ClientModal'
import { formatearFecha } from '../utils/helpers'
import ErrorState from '../components/ErrorState'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(null)
  const [confirmando, setConfirmando] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  async function cargar() {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
    if (e) { setError(e.message); setLoading(false); return }
    setClientes(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function confirmarToggle() {
    const cliente = confirmando
    const nuevoValor = cliente.activo === false ? true : false
    setConfirmando(null)
    const { error } = await supabase.from('clientes').update({ activo: nuevoValor }).eq('id', cliente.id)
    if (error) { alert('Error al actualizar: ' + error.message); return }
    setClientes((prev) => prev.map((c) => c.id === cliente.id ? { ...c, activo: nuevoValor } : c))
  }

  const filtrado = useMemo(() => {
    if (!busqueda.trim()) return clientes
    const q = busqueda.toLowerCase()
    return clientes.filter((c) =>
      (c.nombre_completo || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  }, [clientes, busqueda])

  const paginated = paginate(filtrado, page, pageSize)

  const columns = [
    { key: 'nombre_completo', label: 'Nombre Completo' },
    { key: 'email', label: 'Email' },
    { key: 'telefono', label: 'Teléfono', render: (r) => r.telefono || '—' },
    { key: 'created_at', label: 'Registrado', render: (r) => formatearFecha(r.created_at) },
    {
      key: 'activo', label: 'Acceso',
      render: (r) => {
        const activo = r.activo !== false
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmando(r) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.78rem', fontFamily: 'Inter, sans-serif',
              background: activo ? '#d7f3e3' : '#fde2e1',
              color: activo ? '#177d48' : '#b42318',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: activo ? '#177d48' : '#b42318', flexShrink: 0 }} />
            {activo ? 'Habilitado' : 'Bloqueado'}
          </button>
        )
      },
    },
    { key: 'acciones', label: '', render: (r) => (
<button 
  className="btn-icon" 
  title="Editar" 
  style={{ transform: 'scaleX(-1)' }} 
  onClick={() => setModal(r)}
>
  ✏️
</button>    )},
  ]

  if (error) return <ErrorState mensaje={error} onRetry={cargar} />

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{filtrado.length} cliente(s)</p>
        </div>
        <button className="btn-topbar" onClick={() => setModal('nuevo')}>+ Nuevo cliente</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <input
          className="input-filtro"
          placeholder="Buscar por nombre o email..."
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
          style={{ maxWidth: 380 }}
        />
      </div>

      <div className="card">
        <Table columns={columns} data={paginated} loading={loading} emptyMessage="No hay clientes registrados." />
        <Pagination page={page} pageSize={pageSize} total={filtrado.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} label="clientes" />
      </div>

      {confirmando && (
        <div className="modal-backdrop" onClick={() => setConfirmando(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-modal-msg">
              {confirmando.activo !== false
                ? <>¿Deseas <strong>desactivar</strong> a "{confirmando.nombre_completo}"?</>
                : <>¿Deseas <strong>activar</strong> a "{confirmando.nombre_completo}"?</>
              }
            </p>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-cancel" onClick={() => setConfirmando(null)}>Cancelar</button>
              <button
                className="confirm-modal-ok"
                style={{ background: confirmando.activo !== false ? '#b42318' : '#177d48' }}
                onClick={confirmarToggle}
              >
                {confirmando.activo !== false ? 'Sí, desactivar' : 'Sí, activar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <ClientModal
          cliente={modal === 'nuevo' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
    </div>
  )
}
