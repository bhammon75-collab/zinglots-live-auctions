import * as React from 'react'

export function CountdownPill({ endsAt }:{ endsAt: string }) {
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = Math.max(0, new Date(endsAt).getTime() - now)
  const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000)
  const label = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  const cls = ms <= 120000 ? 'time-pill time-urgent' : ms <= 600000 ? 'time-pill time-soon' : 'time-pill time-ok'
  return <span aria-live="polite" className={cls}>{label}</span>
}