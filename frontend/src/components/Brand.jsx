import { BrainCircuit } from 'lucide-react'

export default function Brand({ light = false }) {
  return (
    <span className={`brand-lockup${light ? ' brand-lockup-light' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <BrainCircuit size={19} strokeWidth={2.2} />
      </span>
      <span className="brand-word">knowflow<span>.</span></span>
    </span>
  )
}
