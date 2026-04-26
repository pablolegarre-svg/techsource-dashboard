export default function ErrorState({ mensaje, onRetry }) {
  return (
    <div className="error-state">
      <div className="error-state-icon">⚠</div>
      <p className="error-state-title">Algo salió mal</p>
      <p className="error-state-msg">{mensaje || 'No se pudieron cargar los datos. Verificá tu conexión.'}</p>
      {onRetry && (
        <button className="error-state-btn" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
