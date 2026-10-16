import { useState } from 'react'
import { compact, shortDay } from '../format'

const W = 800
const H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 52 }

// Butun sonli (soni) grafik uchun chiroyli o'q: 0, 1, 2... yoki 0, 5, 10... (kasr "1 1 1" bo'lib ko'rinmasin)
function countAxis(rawMax) {
  const target = Math.max(rawMax, 1)
  if (target <= 4) return { max: target, ticks: Array.from({ length: target + 1 }, (_, i) => i) }
  const rough = target / 4
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough)
  const max = Math.ceil(target / step) * step
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) }
}

// Kunlik grafik: kind="area" (tushum) yoki kind="bar" (buyurtmalar soni). SVG, kutubxonasiz.
export default function Chart({ data, kind = 'area', format = String, axisFormat = compact, label }) {
  const [hover, setHover] = useState(null)
  if (!data.length) return <p className="muted">Ma'lumot yo'q</p>

  const rawMax = Math.max(...data.map((d) => d.value), 1)
  const axis = kind === 'bar' ? countAxis(rawMax) : null
  const max = axis ? axis.max : rawMax
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW
  const x = (i) => PAD.left + (kind === 'bar' ? (innerW / data.length) * (i + 0.5) : step * i)
  const y = (v) => PAD.top + innerH - (v / max) * innerH
  const ticks = axis ? axis.ticks : [0, 0.25, 0.5, 0.75, 1].map((t) => max * t)

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(data.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`
  const barW = Math.max(2, (innerW / data.length) * 0.62)

  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i)

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    const idx = kind === 'bar'
      ? Math.floor(((px - PAD.left) / innerW) * data.length)
      : Math.round((px - PAD.left) / step)
    setHover(Math.min(data.length - 1, Math.max(0, idx)))
  }

  const point = hover !== null ? data[hover] : null

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`fill-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="chart-axis">{axisFormat(Math.round(t))}</text>
          </g>
        ))}

        {kind === 'area' ? (
          <>
            <path d={area} fill={`url(#fill-${label})`} />
            <path d={line} className="chart-line" />
          </>
        ) : (
          data.map((d, i) => (
            <rect
              key={d.date}
              x={x(i) - barW / 2}
              y={y(d.value)}
              width={barW}
              height={Math.max(0, PAD.top + innerH - y(d.value))}
              rx="3"
              className={`chart-bar ${hover === i ? 'is-hover' : ''}`}
            />
          ))
        )}

        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="chart-axis">
            {shortDay(data[i].date)}
          </text>
        ))}

        {point && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="chart-cursor" />
            <circle cx={x(hover)} cy={y(point.value)} r="4.5" className="chart-dot" />
          </>
        )}
      </svg>

      {point && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{format(point.value)}</strong>
          <span>{shortDay(point.date)}</span>
        </div>
      )}
    </div>
  )
}
