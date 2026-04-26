import { useState } from 'react'
import { supabase } from '../supabase'
import Modal from './Modal'

export default function ClientModal({ cliente = null, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre_completo: cliente?.nombre_completo ?? '',
    email: cliente?.email ?? '',
    telefono: cliente?.telefono ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: field === 'email' ? value.toLowerCase() : value }))
  }

  async function guardar() {
    if (!form.nombre_completo.trim() || !form.email.trim()) {
      setError('Nombre y email son obligatorios.')
      return
    }
    setGuardando(true)
    setError('')

    const payload = {
      nombre_completo: form.nombre_completo.trim(),
      email: form.email.trim(),
      telefono: form.telefono.trim() || null,
    }

    const { error: err } = cliente?.id
      ? await supabase.from('clientes').update(payload).eq('id', cliente.id)
      : await supabase.from('clientes').insert([payload])

    setGuardando(false)
    if (err) { setError('Error al guardar. Revisá los datos.'); return }
    onSaved?.()
    onClose()
  }

  return (
    <Modal title={cliente ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <div className="login-error">{error}</div>}

        <div>
          <label className="label-form">Nombre completo *</label>
          <input
            className="input-filtro"
            value={form.nombre_completo}
            onChange={(e) => set('nombre_completo', e.target.value)}
            placeholder="Juan García"
          />
        </div>
        <div>
          <label className="label-form">Email *</label>
          <input
            className="input-filtro"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="juan@empresa.com"
          />
        </div>
        <div>
          <label className="label-form">Teléfono</label>
          <input
            className="input-filtro"
            value={form.telefono}
            onChange={(e) => set('telefono', e.target.value)}
            placeholder="+54 9 11 0000-0000"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button className="btn-primary" onClick={onClose}>Cancelar</button>
          <button className="btn-topbar" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
