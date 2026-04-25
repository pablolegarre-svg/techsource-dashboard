import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function LoginCliente({ onClienteLogin }) {
  const navigate = useNavigate()
  const [email, setEmail]     = useState('')
  const [paso, setPaso]       = useState('email')
  const [cliente, setCliente] = useState(null)
  const [codigo, setCodigo]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleEmail(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from('clientes')
      .select('*')
      .ilike('email', email)
      .maybeSingle()

    if (queryError || !data) {
      setLoading(false)
      setPaso('no-encontrado')
      return
    }
    if (data.activo === false) {
      setLoading(false)
      setPaso('inactivo')
      return
    }

    const response = await fetch('https://n8n.srv1164728.hstgr.cloud/webhook/techsource-otp-generar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email }),
    })

    let payload
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    setLoading(false)

    if (!response.ok || !payload?.ok) {
      setError('No pudimos enviar el código. Intentá nuevamente.')
      return
    }

    setCliente(data)
    setCodigo('')
    setPaso('otp')
  }

  async function handleOtp(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const response = await fetch('https://n8n.srv1164728.hstgr.cloud/webhook/techsource-otp-verificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cliente?.email, codigo: codigo }),
    })

    let payload
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    setLoading(false)

    if (response.ok && payload?.ok) {
      onClienteLogin(cliente)
      navigate('/mis-cotizaciones', { replace: true })
      return
    }

    setError('Código incorrecto. Verificá los 6 dígitos y volvé a intentarlo.')
  }

  function entrarComoCliente() {
    onClienteLogin(cliente)
    navigate('/mis-cotizaciones', { replace: true })
  }

  return (
    <>
      <div className="bg-illustration" />
      <div className="login-page">
        <div className="login-card">

          <div className="login-logo">
            <img src="/assets/logo.png" alt="TechSource Solutions" />
          </div>

          <h2>Iniciar sesión</h2>

          {error && <div className="login-error" style={{ marginBottom: 18 }}>{error}</div>}

          {paso === 'email' && (
            <form className="login-form" onSubmit={handleEmail}>
              <input
                type="email"
                placeholder="Tu correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? 'Verificando...' : 'Continuar'}
              </button>
              
            </form>
          )}

          {paso === 'no-encontrado' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <div style={{
                background: '#fff8ec', border: '1px solid #f5d78e',
                borderRadius: 12, padding: '20px 18px',
              }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#1d315d', fontSize: '0.95rem' }}>
                  Sin registros encontrados
                </p>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#7a6030' }}>
                  Aún no tenés compras o cotizaciones registradas con nosotros.
                </p>
              </div>
              <Link to="/cotizar" className="login-btn" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Solicitar una cotización
              </Link>
              <button
                type="button"
                onClick={() => { setPaso('email'); setError('') }}
                style={{ background: 'none', border: 'none', color: '#9aaabf', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                ← Intentar con otro correo
              </button>
            </div>
          )}

          {paso === 'inactivo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <div style={{
                background: '#fff1f0', border: '1px solid #fbc5c3',
                borderRadius: 12, padding: '20px 18px',
              }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#1d315d', fontSize: '0.95rem' }}>
                  Usuario inactivo
                </p>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#9b2c2c' }}>
                  Tu usuario se encuentra inactivo. Contactá al administrador para rehabilitar tu acceso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setPaso('email'); setError('') }}
                style={{ background: 'none', border: 'none', color: '#9aaabf', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                ← Volver
              </button>
            </div>
          )}

          {paso === 'otp' && cliente && (
            <form className="login-form" onSubmit={handleOtp}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: '#f0f7ff', border: '1px solid #ccdeff',
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: '#2f6fed',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.1rem', flexShrink: 0,
                  }}>
                    {(cliente.nombre_completo || cliente.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#1d315d', fontSize: '0.95rem' }}>
                      {cliente.nombre_completo}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6a7d9c' }}>{cliente.email}</p>
                  </div>
                </div>

                <div style={{ textAlign: 'center', color: '#5b6f93', fontSize: '0.92rem' }}>
                  Te enviamos un código de 6 dígitos a tu correo. Ingresalo para completar el inicio de sesión.
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Código de 6 dígitos"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                />

                <button className="login-btn" type="submit" disabled={loading || codigo.length !== 6}>
                  {loading ? 'Verificando...' : 'Verificar código'}
                </button>

                <button
                  type="button"
                  onClick={() => { setPaso('email'); setCliente(null); setCodigo(''); setError('') }}
                  style={{ background: 'none', border: 'none', color: '#9aaabf', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  ← Cambiar correo
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </>
  )
}
