interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

// Generic yes/no confirmation overlay — used anywhere an action has a real cost
// (caps forfeited, no refund) that shouldn't be triggerable by a stray click.
export function ConfirmDialog({ title, message, confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL', onConfirm, onCancel }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        className="border border-pip-border rounded p-4 flex flex-col gap-4"
        style={{
          background: 'var(--pip-bg)',
          boxShadow: '0 0 0 1px var(--pip-border-dim), 0 8px 32px rgba(0,0,0,0.6)',
          maxWidth: '22rem',
          width: '100%',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-pip-red font-display text-lg border-b border-pip-border pb-2">
          {title}
        </div>
        <div className="text-sm text-pip-green-dim leading-relaxed">
          {message}
        </div>
        <div className="flex gap-3">
          <button className="pip-btn flex-1" onClick={onCancel}>{cancelLabel}</button>
          <button className="pip-btn-danger flex-1" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
