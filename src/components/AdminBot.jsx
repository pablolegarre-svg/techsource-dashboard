import { useState, useRef, useEffect } from 'react'

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_ADMINBOT

const SUGGS = [
  { label: '📊 Estado general',        texto: '¿Cómo vamos hoy?' },
  { label: '📋 Cotizaciones',          texto: 'Últimas cotizaciones' },
  { label: '👥 Clientes',              texto: '¿Cuántos clientes tenemos?' },
  { label: '📈 Precios',               texto: 'Producto con mayor variación de precio' },
  { label: '💰 Total cotizado',        texto: 'Total cotizado hasta hoy' },
]

export default function AdminBot() {
  const [abierto, setAbierto]       = useState(false)
  const [mensajes, setMensajes]     = useState([])
  const [historial, setHistorial]   = useState([])
  const [input, setInput]           = useState('')
  const [cargando, setCargando]     = useState(false)
  const [notif, setNotif]           = useState(false)
  const [iniciado, setIniciado]     = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const msgsRef        = useRef(null)
  const inputRef       = useRef(null)
  const reconocimiento = useRef(null)

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [mensajes, cargando])

  function hora() {
    return new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  function addMsg(tipo, texto) {
    setMensajes((prev) => [...prev, { tipo, texto, hora: hora() }])
  }

  function toggle() {
    setAbierto((v) => {
      if (!v && !iniciado) {
        setIniciado(true)
        setTimeout(() => addMsg('bot',
          'Hola! Soy AdminBot, tu asistente del panel administrativo de TechSource.\n\n' +
          'Tengo acceso a:\n- Catálogo de productos\n- Cotizaciones y clientes\n- Historial de cambios de precios\n\n' +
          '¿Qué necesitas consultar?'
        ), 350)
      }
      if (!v) setTimeout(() => inputRef.current?.focus(), 450)
      setNotif(false)
      return !v
    })
  }

  function reset() {
    setHistorial([])
    setIniciado(true)
    setMensajes([])
    setTimeout(() => addMsg('bot',
      'Hola! Soy AdminBot, tu asistente del panel administrativo de TechSource.\n\n' +
      'Tengo acceso a:\n- Catálogo de productos\n- Cotizaciones y clientes\n- Historial de cambios de precios\n\n' +
      '¿Qué necesitas consultar?'
    ), 200)
  }

  async function enviar(textoForzado) {
    if (cargando) return
    const texto = (textoForzado || input).trim()
    if (!texto) return

    setInput('')
    addMsg('user', texto)

    const nuevoHistorial = [...historial, { rol: 'user', texto }]
    setHistorial(nuevoHistorial)
    setCargando(true)

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto, historial: nuevoHistorial.slice(-12) }),
      })

      if (!res.ok) throw new Error(`Error ${res.status}`)

      const data = await res.json()
      const resp = data.respuesta || 'Error al procesar la consulta.'
      addMsg('bot', resp)
      setHistorial((prev) => [...prev, { rol: 'assistant', texto: resp }])

      if (!abierto) setNotif(true)
    } catch {
      addMsg('bot', 'No pude conectarme. Verificá que el workflow de n8n está activo.')
    }

    setCargando(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function toggleMic() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.')
      return
    }
    if (escuchando) {
      reconocimiento.current?.stop()
    } else {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      const rec = new SR()
      reconocimiento.current = rec
      rec.lang = 'es-ES'
      rec.continuous = false
      rec.interimResults = true

      rec.onstart = () => setEscuchando(true)

      rec.onresult = (e) => {
        const transcript = Array.from(e.results).map((r) => r[0].transcript).join('')
        setInput(transcript)
      }

      rec.onend = () => {
        setEscuchando(false)
        setInput((val) => {
          if (val.trim()) setTimeout(() => enviarDirecto(val.trim()), 300)
          return val
        })
      }

      rec.onerror = (e) => {
        setEscuchando(false)
        if (e.error === 'not-allowed') alert('Permiso de micrófono denegado. Activalo en la configuración del navegador.')
      }

      rec.start()
    }
  }

  function enviarDirecto(texto) {
    if (cargando || !texto) return
    setInput('')
    enviar(texto)
  }

  const mostrarSuggs = mensajes.length <= 1

  return (
    <>
      <button
        className={`adminbot-fab${abierto ? ' open' : ''}`}
        onClick={toggle}
        title="AdminBot — Asistente IA"
      >
        <svg className="adminbot-fab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <svg className="adminbot-fab-close" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        {notif && <span className="adminbot-notif">1</span>}
      </button>

      <div className={`adminbot-panel${abierto ? ' open' : ''}`}>

        <div className="adminbot-header">
          <div className="adminbot-header-info">
            <div className={`adminbot-avatar${cargando ? ' thinking' : ''}`}>AB</div>
            <div>
              <h3>AdminBot</h3>
              <p>{cargando ? 'Consultando datos...' : 'Asistente IA — Panel administrativo'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="adminbot-header-btn" onClick={reset} title="Nueva consulta">↺</button>
            <button className="adminbot-header-btn" onClick={toggle}>✕</button>
          </div>
        </div>

        <div className="adminbot-msgs" ref={msgsRef}>
          {mensajes.map((m, i) => (
            <div key={i} className={`adminbot-msg ${m.tipo}`}>
              <div className="adminbot-msg-bubble">{m.texto}</div>
              <div className="adminbot-msg-time">{m.hora}</div>
            </div>
          ))}
          {cargando && (
            <div className="adminbot-msg bot">
              <div className="adminbot-typing">
                <span/><span/><span/>
              </div>
            </div>
          )}
        </div>

        {mostrarSuggs && (
          <div className="adminbot-suggs">
            {SUGGS.map((s) => (
              <button key={s.texto} className="adminbot-sq" onClick={() => enviar(s.texto)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="adminbot-input-row">
          <input
            ref={inputRef}
            className="adminbot-input"
            type="text"
            placeholder={escuchando ? 'Escuchando...' : 'Consulta datos del negocio...'}
            value={input}
            maxLength={500}
            disabled={cargando}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          />
          <button
            className={`adminbot-mic${escuchando ? ' escuchando' : ''}`}
            onClick={toggleMic}
            title="Hablar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={escuchando ? '#E74C3C' : '#64748b'} strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <button className="adminbot-send" onClick={() => enviar()} disabled={cargando || !input.trim()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

      </div>
    </>
  )
}
