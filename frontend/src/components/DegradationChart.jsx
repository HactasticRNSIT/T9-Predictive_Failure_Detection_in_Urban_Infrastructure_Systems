import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const COLORS = {
  critical: { line: '#ff4757', bg: 'rgba(255,71,87,0.15)' },
  watch: { line: '#ffb830', bg: 'rgba(255,184,48,0.15)' },
  stable: { line: '#34d399', bg: 'rgba(52,211,153,0.15)' },
}

export default function DegradationChart({ history, status, labels }) {
  const c = COLORS[status] || COLORS.stable

  const data = {
    labels,
    datasets: [
      {
        data: history,
        borderColor: c.line,
        backgroundColor: c.bg,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: c.line,
        pointBorderColor: 'transparent',
        tension: 0.35,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: {
        ticks: { color: '#556677', font: { size: 9 } },
        grid: { color: 'rgba(42,64,96,0.3)' },
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#556677', font: { size: 9 }, stepSize: 25 },
        grid: { color: 'rgba(42,64,96,0.3)' },
      },
    },
  }

  return (
    <div style={{ height: 140 }}>
      <Line data={data} options={options} />
    </div>
  )
}
