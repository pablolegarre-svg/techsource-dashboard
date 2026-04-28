// columns = [{ key, label, render? }]
// data = array of objects
// loading = boolean
// emptyMessage = string
export default function Table({ columns, data, loading, emptyMessage = 'No hay datos.', onRowClick }) {
  if (loading) {
    return <p className="table-loading">Cargando...</p>
  }

  if (!data.length) {
    return <p style={{ color: '#6b7c98' }}>{emptyMessage}</p>
  }

  return (
    <div className="tabla-wrapper">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.style}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} style={col.style}>
                  {col.render ? col.render(row) : (row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
