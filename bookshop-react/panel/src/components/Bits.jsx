import { STATUS_LABELS } from '../format'

// Kichik umumiy bo'laklar: holat nishoni, o'sish foizi, statistika kartasi, sahifalash, yuklanish

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>
}

export function Growth({ value }) {
  if (value === null || value === undefined) return <span className="growth growth-none">oldingi davr yo'q</span>
  if (value === 0) return <span className="growth growth-none">o'zgarmadi</span>
  const up = value > 0
  return <span className={`growth ${up ? 'growth-up' : 'growth-down'}`}>{up ? '▲' : '▼'} {Math.abs(value)}%</span>
}

export function StatCard({ title, value, hint, children }) {
  return (
    <div className="card stat">
      <span className="stat-title">{title}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
      {children}
    </div>
  )
}

export function Pagination({ page, count, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return null
  return (
    <div className="pagination">
      <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Oldingi</button>
      <span>{page} / {pages}</span>
      <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>Keyingi →</button>
    </div>
  )
}

export function Loading({ error }) {
  if (error) return <p className="alert">Ma'lumotni yuklab bo'lmadi. Server ishlayotganini tekshiring.</p>
  return <p className="muted">Yuklanmoqda…</p>
}

// Jadval sarlavhasi: bosilganda tartiblash (ordering parametri bilan)
export function SortTh({ field, ordering, onSort, children, align }) {
  const active = ordering.replace('-', '') === field
  const desc = ordering === `-${field}`
  return (
    <th className={`sortable ${align === 'right' ? 'right' : ''} ${active ? 'active' : ''}`}>
      <button type="button" onClick={() => onSort(active && desc ? field : `-${field}`)}>
        {children}
        <span aria-hidden="true">{active ? (desc ? ' ↓' : ' ↑') : ''}</span>
      </button>
    </th>
  )
}
