type Props = {
  denied: boolean
  busy: boolean
  onOpen: () => void
  onPick: () => void
}

export function Gate({ denied, busy, onOpen, onPick }: Props) {
  return (
    <div className="gate">
      <p className="gate-kicker">optical bench</p>
      {denied ? (
        <>
          <h2>Lens blocked.</h2>
          <p>Drop a still or pick a file. Same hash path either way.</p>
        </>
      ) : (
        <>
          <h2>Point the glass.</h2>
          <p>Camera stays dark until you ask. Hash is a PDA preview, not a key.</p>
        </>
      )}
      <div className="gate-actions">
        {!denied && (
          <button type="button" className="primary" onClick={onOpen} disabled={busy}>
            {busy ? 'opening…' : 'open the shutter'}
          </button>
        )}
        <button type="button" onClick={onPick}>
          pick a still
        </button>
      </div>
    </div>
  )
}
