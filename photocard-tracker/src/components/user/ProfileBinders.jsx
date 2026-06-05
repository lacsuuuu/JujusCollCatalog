import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { optimizeUrl } from '../../utils/imageKitUtils';

export default function ProfileBinders({ userId, globalMerch }) {
  const navigate = useNavigate();
  const [binders, setBinders] = useState([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'binders'),
      where('userId', '==', userId),
      where('isPublic', '==', true)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setBinders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  if (loading || binders.length === 0) return null;

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div style={{ borderBottom: '1px solid #C2B0B4', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527' }}>
          Binders <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '1rem' }}>({binders.length})</span>
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
        {binders.map(binder => {
          const cardCount = Object.keys(binder.slots || {}).length;
          const coverPageNum = binder.coverPage ?? 0;

          return (
            <div
              key={binder.id}
              onClick={() => navigate(`/binders/${binder.id}`)}
              style={{ backgroundColor: '#D4C4C7', borderRadius: '12px', padding: '1.25rem 1rem', boxShadow: '0 4px 12px rgba(49,37,39,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(49,37,39,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(49,37,39,0.08)'; }}
            >
              <div style={{ width: '100px', height: '130px', backgroundColor: '#C2B0B4', borderRadius: '4px 10px 10px 4px', borderLeft: '10px solid #8D6E73', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: binder.type === 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gridAutoRows: '1fr', gap: '3px', padding: '8px', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                  {Array.from({ length: binder.type }).map((_, i) => {
                    const merchId = binder.slots?.[`${coverPageNum}-${i}`];
                    const card = merchId ? globalMerch?.find(m => m.id === merchId) : null;
                    return (
                      <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '2px', overflow: 'hidden' }}>
                        {card && <img src={optimizeUrl(card.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable="false" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', color: '#312527', fontSize: '1rem', fontWeight: '700' }}>{binder.name}</h3>
                <p style={{ margin: 0, color: '#6A585B', fontSize: '0.8rem', fontWeight: '500' }}>{binder.type}-Pocket • {cardCount} Cards</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}