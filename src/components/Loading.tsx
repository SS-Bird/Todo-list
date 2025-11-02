export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '24px 0' }}>
      <div style={{ opacity: 0.9 }}>{label}</div>
    </div>
  );
}


