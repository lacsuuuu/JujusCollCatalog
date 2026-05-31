export default function ThemeAlert({ message, onClose, hideButton }) {
  if (!message) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(49, 37, 39, 0.6)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: '#E6DADD',
        padding: '1.5rem 2rem',
        borderRadius: '12px',
        border: '1px solid #D4C4C7',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <p style={{ color: '#312527', margin: '0 0 1.5rem 0', fontWeight: '600' }}>{message}</p>
        {!hideButton && (
        <button
          onClick={onClose}
          style={{ padding: '0.5rem 2rem', backgroundColor: '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          OK
        </button>
        )}
      </div>
    </div>
  );
}