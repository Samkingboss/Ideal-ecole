import { useId, useState } from 'react'

/**
 * Bloc repliable commun à toutes les interfaces.
 * Les actions essentielles restent hors accordéon ; ce composant sert aux
 * détails, historiques et formulaires secondaires.
 */
export default function AccordionCard({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = '',
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const contentId = useId()
  const open = controlledOpen ?? internalOpen

  const toggle = () => {
    const next = !open
    if (controlledOpen === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <section className={`accordion-card ${open ? 'is-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="accordion-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
      >
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          {icon && <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>}
          <span style={{ minWidth: 0 }}>
            <span className="accordion-title">{title}</span>
            {subtitle && <span className="accordion-subtitle" style={{ display: 'block' }}>{subtitle}</span>}
          </span>
        </span>
        <span className="accordion-chevron" aria-hidden="true">⌄</span>
      </button>
      <div id={contentId} className="accordion-content" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
