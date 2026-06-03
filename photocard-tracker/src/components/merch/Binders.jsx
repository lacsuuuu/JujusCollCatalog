import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, deleteField } from 'firebase/firestore';
import ThemeAlert from '../ui/ThemeAlert';

export default function Binders({ user }) {
  const [binders, setBinders] = useState([]);
  const [merch, setMerch] = useState([]);
  const [activeBinder, setActiveBinder] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // States for active binder view
  const [currentPage, setCurrentPage] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Modal/Creation/Confirmation states
  const [showCreate, setShowCreate] = useState(false);
  const [newBinderName, setNewBinderName] = useState('');
  const [newBinderType, setNewBinderType] = useState(9);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  // Drag and Drop state
  const [dragOverSlot, setDragOverSlot] = useState(null);

  useEffect(() => {
    const unsubBinders = onSnapshot(collection(db, 'binders'), (snapshot) => {
      setBinders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    
    const unsubMerch = onSnapshot(collection(db, 'merchandise'), (snapshot) => {
      setMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubBinders(); unsubMerch(); };
  }, []);

  useEffect(() => {
    if (activeBinder) {
      const updated = binders.find(b => b.id === activeBinder.id);
      if (updated) setActiveBinder(updated);
      else setActiveBinder(null);
    }
  }, [binders, activeBinder]);

  const handleCreateBinder = async () => {
    if (!newBinderName.trim()) return;
    try {
      await addDoc(collection(db, 'binders'), {
        name: newBinderName.trim(),
        type: Number(newBinderType),
        slots: {},
        coverPage: 0,
        totalPages: 1, 
        createdAt: new Date().toISOString()
      });
      setShowCreate(false);
      setNewBinderName('');
      setAlertMsg("Binder created!");
    } catch (e) {
      setAlertMsg("Error creating binder.");
    }
  };

  const computedTotalPages = activeBinder 
    ? Math.max(
        activeBinder.totalPages || 1, 
        Object.keys(activeBinder.slots || {}).reduce((max, key) => Math.max(max, parseInt(key.split('-')[0], 10) + 1), 1)
      )
    : 1;

  const handleAddPage = async () => {
    if (!user || !activeBinder) return;
    try {
      await updateDoc(doc(db, 'binders', activeBinder.id), { totalPages: computedTotalPages + 1 });
      setCurrentPage(computedTotalPages); 
    } catch (e) {
      setAlertMsg("Error adding page.");
    }
  };

  const handleDeletePage = async () => {
    if (!user || !activeBinder) return;

    let hasCards = false;
    for (let i = 0; i < activeBinder.type; i++) {
      if (activeBinder.slots?.[`${currentPage}-${i}`]) {
        hasCards = true;
        break;
      }
    }

    const executeDelete = async () => {
      const updates = {};
      
      for (let i = 0; i < activeBinder.type; i++) {
        if (activeBinder.slots?.[`${currentPage}-${i}`]) {
          updates[`slots.${currentPage}-${i}`] = deleteField();
        }
      }
      
      Object.keys(activeBinder.slots || {}).forEach(key => {
        const [p, s] = key.split('-');
        const pageNum = parseInt(p, 10);
        const slotNum = parseInt(s, 10);
        
        if (pageNum > currentPage) {
          updates[`slots.${pageNum - 1}-${slotNum}`] = activeBinder.slots[key];
          updates[`slots.${pageNum}-${slotNum}`] = deleteField();
        }
      });

      if (activeBinder.coverPage === currentPage) {
        updates.coverPage = null; 
      } else if (activeBinder.coverPage > currentPage) {
        updates.coverPage = activeBinder.coverPage - 1; 
      }

      const newTotal = Math.max(1, computedTotalPages - 1);
      updates.totalPages = newTotal;

      try {
        await updateDoc(doc(db, 'binders', activeBinder.id), updates);
        if (currentPage >= newTotal) setCurrentPage(newTotal - 1);
      } catch (e) {
        setAlertMsg("Error deleting page.");
      }
    };

    if (hasCards) {
      setConfirmAction({
        message: "Are you sure you want to delete this page? Any cards here will be returned to your collection.",
        onConfirm: executeDelete
      });
    } else {
      await executeDelete();
    }
  };

  const handleCollectionClick = async (merchId) => {
    if (!isEditing || !user) return;
    
    let emptySlot = -1;
    for (let i = 0; i < activeBinder.type; i++) {
      if (!activeBinder.slots?.[`${currentPage}-${i}`]) {
        emptySlot = i;
        break;
      }
    }

    if (emptySlot === -1) {
      setAlertMsg("This page is full! Add a new page or switch pages.");
      return;
    }

    const targetKey = `${currentPage}-${emptySlot}`;
    try {
      await updateDoc(doc(db, 'binders', activeBinder.id), {
        [`slots.${targetKey}`]: merchId
      });
    } catch (e) {
      setAlertMsg("Error adding card to binder.");
    }
  };

  const handleDeleteBinder = (id) => {
    setConfirmAction({
      message: "Are you sure you want to delete this binder? Your photocards will remain in your collection.",
      onConfirm: async () => {
        await deleteDoc(doc(db, 'binders', id));
        setActiveBinder(null);
        setIsEditing(false);
      }
    });
  };

  const handleRenameSave = async () => {
    if (editNameValue.trim() && editNameValue !== activeBinder.name) {
      await updateDoc(doc(db, 'binders', activeBinder.id), { name: editNameValue.trim() });
    }
    setEditingName(false);
  };

  const handleSetCover = async () => {
    if (!user) return;
    try {
      const newCover = activeBinder.coverPage === currentPage ? null : currentPage;
      await updateDoc(doc(db, 'binders', activeBinder.id), { coverPage: newCover });
      setAlertMsg(newCover === null ? "Cover page removed." : "Binder cover updated!");
    } catch (e) {
      setAlertMsg("Error updating cover.");
    }
  };

  const removeCardFromSlot = async (slotIndex) => {
    if (!user || !isEditing) return;
    const slotKey = `${currentPage}-${slotIndex}`;
    try {
      await updateDoc(doc(db, 'binders', activeBinder.id), {
        [`slots.${slotKey}`]: deleteField()
      });
    } catch (e) {
      setAlertMsg("Error removing card.");
    }
  };

  const handleCollectionDragStart = (e, merchId) => {
    if (!isEditing) return;
    e.dataTransfer.setData('source', 'collection');
    e.dataTransfer.setData('merchId', merchId);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleSlotDragStart = (e, slotIndex) => {
    if (!isEditing) return;
    e.dataTransfer.setData('source', 'slot');
    e.dataTransfer.setData('slotIndex', slotIndex.toString());
    e.dataTransfer.effectAllowed = "move";
    
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault(); 
    if (isEditing) setDragOverSlot(index);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (e, targetSlot) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (!user || !isEditing) return;

    const source = e.dataTransfer.getData('source');
    const targetKey = `${currentPage}-${targetSlot}`;

    try {
      if (source === 'collection') {
        const merchId = e.dataTransfer.getData('merchId');
        await updateDoc(doc(db, 'binders', activeBinder.id), {
          [`slots.${targetKey}`]: merchId
        });
      } 
      else if (source === 'slot') {
        const sourceSlot = parseInt(e.dataTransfer.getData('slotIndex'), 10);
        if (sourceSlot === targetSlot) return; 

        const sourceKey = `${currentPage}-${sourceSlot}`;
        const sourceMerchId = activeBinder.slots?.[sourceKey];
        const targetMerchId = activeBinder.slots?.[targetKey];

        const updates = {};
        
        if (targetMerchId) updates[`slots.${sourceKey}`] = targetMerchId;
        else updates[`slots.${sourceKey}`] = deleteField();

        if (sourceMerchId) updates[`slots.${targetKey}`] = sourceMerchId;
        else updates[`slots.${targetKey}`] = deleteField();

        await updateDoc(doc(db, 'binders', activeBinder.id), updates);
      }
    } catch (err) {
      setAlertMsg("Error updating binder slots.");
    }
  };

  if (loading) return <div style={{ textAlign: 'center', color: '#6A585B', padding: '3rem' }}>Loading binders...</div>;

  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.3s' }}>
      <style>{`
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #8D6E73 !important; }
        
        .binder-card { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
        .binder-card:hover { transform: translateY(-4px); box-shadow: 0 8px 16px rgba(49,37,39,0.15) !important; }
        
        .slot-container {
           aspect-ratio: 63 / 100;
           border-radius: 8px;
           overflow: hidden;
           background-color: rgba(255,255,255,0.4);
           border: 2px dashed #A08D90;
           display: flex;
           justify-content: center;
           align-items: center;
           position: relative;
           transition: all 0.2s;
        }
        .slot-container.filled { border: 2px solid transparent; background-color: transparent; }
        .slot-container.editable { cursor: grab; }
        .slot-container.editable:active { cursor: grabbing; }
        .slot-container.editable:hover { border-color: #8D6E73; }
        .slot-container.dragging-over { border-color: #312527 !important; background-color: rgba(141, 110, 115, 0.3) !important; }
        
        .slot-image { width: 100%; height: 100%; object-fit: cover; }
        
        .slot-remove-btn {
           position: absolute; top: 6px; right: 6px; width: 30px; height: 30px;
           background: rgba(49,37,39,0.65); backdrop-filter: blur(4px); color: white;
           border-radius: 50%; border: none;
           display: flex; justify-content: center; align-items: center; cursor: pointer;
           opacity: 0; transition: all 0.2s; z-index: 10;
           padding: 0; 
           line-height: 0; 
        }
        .slot-container:hover .slot-remove-btn { opacity: 1; }
        .slot-remove-btn:hover { filter: brightness(0.8); transform: scale(1.05); }
        
        .slot-remove-btn svg {
           display: block; 
        }

        .merch-picker-item { transition: transform 0.2s; cursor: pointer; }
        .merch-picker-item:hover { transform: scale(1.05); z-index: 5; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        
        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }

        @media (max-width: 900px) {
           .binder-layout { flex-direction: column !important; }
           .collection-panel { width: 100% !important; max-height: 400px !important; }
        }
      `}</style>

      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

      {/* NEW THEMED CONFIRMATION MODAL */}
      {confirmAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49, 37, 39, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#E6DADD', padding: '1.5rem 2rem', borderRadius: '12px', border: '1px solid #D4C4C7', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '320px', width: '90%' }}>
            <p style={{ color: '#312527', margin: '0 0 1.5rem 0', fontWeight: '600', lineHeight: '1.4' }}>{confirmAction.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8D6E73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Delete</button>
              <button onClick={() => setConfirmAction(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!activeBinder ? (
        // ================= DIRECTORY VIEW =================
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527', margin: 0 }}>
              My Binders
            </h2>
            {user && (
              <button onClick={() => setShowCreate(true)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                + New Binder
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2.5rem' }}>
            {binders.map(binder => {
              const cardCount = Object.keys(binder.slots || {}).length;
              return (
                <div key={binder.id} className="binder-card" onClick={() => { setActiveBinder(binder); setCurrentPage(0); setIsEditing(false); }} style={{ backgroundColor: '#D4C4C7', borderRadius: '12px', padding: '2rem 1.5rem', boxShadow: '0 4px 12px rgba(49,37,39,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
                  
                  {/* Visual Binder Icon with Enlarged Cover Page */}
                  <div style={{ width: '150px', height: '200px', backgroundColor: '#C2B0B4', borderRadius: '6px 16px 16px 6px', borderLeft: '16px solid #8D6E73', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: 'inset 3px 0 6px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: binder.type === 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gridAutoRows: '1fr', gap: '4px', padding: '12px', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                      {Array.from({ length: binder.type }).map((_, i) => {
                        const coverPageNum = binder.coverPage ?? 0;
                        const merchId = binder.slots?.[`${coverPageNum}-${i}`];
                        const card = merchId ? merch.find(m => m.id === merchId) : null;
                        
                        return (
                          <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '3px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {card && <img src={card.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable="false" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 0.4rem 0', color: '#312527', fontSize: '1.3rem' }}>{binder.name}</h3>
                    <p style={{ margin: 0, color: '#6A585B', fontSize: '0.95rem', fontWeight: '500' }}>{binder.type}-Pocket • {cardCount} Cards</p>
                  </div>
                </div>
              );
            })}
            {binders.length === 0 && <p style={{ color: '#6A585B', gridColumn: '1 / -1' }}>No binders created yet.</p>}
          </div>

          {/* CREATE MODAL */}
          {showCreate && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(49,37,39,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
              <div style={{ backgroundColor: '#E6DADD', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#312527' }}>Create New Binder</h3>
                
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#6A585B', fontSize: '0.85rem', fontWeight: 'bold' }}>Binder Name</label>
                <input className="theme-input" value={newBinderName} onChange={e => setNewBinderName(e.target.value)} placeholder="e.g., Aespa Collection" style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', marginBottom: '1.5rem', color: '#312527' }} />
                
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#6A585B', fontSize: '0.85rem', fontWeight: 'bold' }}>Page Layout</label>
                <select className="theme-input" value={newBinderType} onChange={e => setNewBinderType(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', marginBottom: '2rem', color: '#312527' }}>
                  <option value={9}>9-Pocket (3x3 Grid)</option>
                  <option value={4}>4-Pocket (2x2 Grid)</option>
                  <option value={3}>3-Pocket (1x3 Grid)</option>
                </select>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={handleCreateBinder} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Create</button>
                  <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', color: '#6A585B', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        
        // ================= ACTIVE BINDER VIEW =================
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* Header Controls */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button onClick={() => { setActiveBinder(null); setIsEditing(false); }} style={{ background: 'none', border: 'none', color: '#6A585B', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Back
            </button>
            
            <div style={{ flex: 1, textAlign: 'center' }}>
              {editingName ? (
                <input 
                  autoFocus className="theme-input" value={editNameValue} onChange={e => setEditNameValue(e.target.value)} onBlur={handleRenameSave} onKeyDown={e => e.key === 'Enter' && handleRenameSave()}
                  style={{ background: '#D4C4C7', border: 'none', borderRadius: '6px', color: '#312527', fontSize: '1.4rem', fontWeight: '700', padding: '0.4rem 1rem', textAlign: 'center' }} 
                />
              ) : (
                <h2 
                  onDoubleClick={() => { if(user) { setEditNameValue(activeBinder.name); setEditingName(true); } }}
                  style={{ margin: 0, fontSize: '1.6rem', fontWeight: '700', color: '#312527', cursor: user ? 'text' : 'default' }}
                  title={user ? "Double click to rename" : ""}
                >
                  {activeBinder.name}
                </h2>
              )}
            </div>

            {user && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setIsEditing(!isEditing)} style={{ padding: '0.5rem 1.2rem', backgroundColor: isEditing ? '#8D6E73' : 'transparent', color: isEditing ? '#FFF' : '#8D6E73', border: '2px solid #8D6E73', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}>
                  {isEditing ? 'Done Editing' : 'Edit Binder'}
                </button>
                {isEditing && (
                  <button onClick={() => handleDeleteBinder(activeBinder.id)} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#A85A66', border: '1px solid #A85A66', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    Delete Binder
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="binder-layout" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', justifyContent: isEditing ? 'flex-start' : 'center' }}>
            
            {/* LEFT COLUMN: THE BINDER ITSELF */}
            <div style={{ flex: isEditing ? '0 0 auto' : '1', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: activeBinder.type === 9 ? '550px' : activeBinder.type === 4 ? '400px' : '500px', margin: isEditing ? '0' : '0 auto' }}>
              
              {/* Page Controls with Heart Favorite Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minWidth: '280px', marginBottom: '1.5rem', backgroundColor: '#D4C4C7', padding: '0.5rem 1.5rem', borderRadius: '30px' }}>
                
                {/* Pagination (Center) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} style={{ background: 'none', border: 'none', cursor: currentPage === 0 ? 'not-allowed' : 'pointer', color: currentPage === 0 ? '#C2B0B4' : '#312527', display: 'flex', padding: 0 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <span style={{ fontWeight: '700', color: '#312527', fontSize: '1rem', minWidth: '95px', textAlign: 'center' }}>
                    Page {currentPage + 1} / {computedTotalPages}
                  </span>
                  <button onClick={() => setCurrentPage(p => Math.min(computedTotalPages - 1, p + 1))} disabled={currentPage >= computedTotalPages - 1} style={{ background: 'none', border: 'none', cursor: currentPage >= computedTotalPages - 1 ? 'not-allowed' : 'pointer', color: currentPage >= computedTotalPages - 1 ? '#C2B0B4' : '#312527', display: 'flex', padding: 0 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
                
                {/* Cover Button (Right) */}
                {user && (
                  <button 
                    onClick={handleSetCover} 
                    title={activeBinder.coverPage === currentPage ? "Remove Cover Page" : "Set as Cover Page"}
                    style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: activeBinder.coverPage === currentPage ? '#8D6E73' : '#A08D90', display: 'flex', transition: 'all 0.2s', padding: 0 }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={activeBinder.coverPage === currentPage ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  </button>
                )}
              </div>

              {/* Binder Render */}
              <div style={{ 
                backgroundColor: '#F9F6F0', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 8px 24px rgba(49,37,39,0.15)',
                width: '100%', borderLeft: '12px solid #C2B0B4', boxSizing: 'border-box'
              }}>
                <div style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: activeBinder.type === 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                }}>
                  {Array.from({ length: activeBinder.type }).map((_, index) => {
                    const merchId = activeBinder.slots?.[`${currentPage}-${index}`];
                    const card = merchId ? merch.find(m => m.id === merchId) : null;
                    const isDragTarget = dragOverSlot === index;

                    return (
                      <div 
                        key={index} 
                        className={`slot-container ${card ? 'filled' : ''} ${isEditing ? 'editable' : ''} ${isDragTarget ? 'dragging-over' : ''}`}
                        draggable={!!(isEditing && card)}
                        onDragStart={(e) => handleSlotDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        {card ? (
                          <>
                            <img src={card.imageUrl} alt={card.customName} className="slot-image" draggable="false" />
                            {isEditing && (
                              <button className="slot-remove-btn" onClick={(e) => { e.stopPropagation(); removeCardFromSlot(index); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#A08D90', fontSize: '2rem', opacity: isEditing ? 0.6 : 0.2 }}>+</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Page Controls (Edit Mode) */}
              {isEditing && user && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                  {computedTotalPages > 1 && (
                    <button 
                      onClick={handleDeletePage} 
                      style={{ padding: '0.6rem 1.2rem', backgroundColor: 'transparent', color: '#A85A66', border: '2px solid #A85A66', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'background 0.2s, color 0.2s' }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#A85A66'; e.currentTarget.style.color = '#FFF'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#A85A66'; }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      Remove Page
                    </button>
                  )}
                  
                  <button 
                    onClick={handleAddPage} 
                    style={{ padding: '0.6rem 1.2rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'filter 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(0.9)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add New Page
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: COLLECTION SIDEBAR (Only visible in Edit Mode) */}
            {isEditing && (
              <div className="collection-panel" style={{ flex: 1, backgroundColor: '#D4C4C7', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: '600px', boxShadow: '0 4px 12px rgba(49,37,39,0.1)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#312527', fontSize: '1.2rem' }}>Photocards</h3>
                <p style={{ margin: '0 0 1rem 0', color: '#6A585B', fontSize: '0.85rem', fontStyle: 'italic' }}>Click or drag cards to add them to the binder.</p>
                
                <input 
                  className="theme-input" 
                  placeholder="Search collection..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', marginBottom: '1.2rem', color: '#312527', outline: 'none', boxSizing: 'border-box' }} 
                />

                <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.75rem', paddingRight: '0.5rem', alignContent: 'start' }}>
                  {merch.filter(m => 
                    (m.customName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (m.memberName || '').toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(item => (
                    <div 
                      key={item.id} 
                      className="merch-picker-item" 
                      draggable
                      onClick={() => handleCollectionClick(item.id)}
                      onDragStart={(e) => handleCollectionDragStart(e, item.id)}
                      style={{ borderRadius: '6px', overflow: 'hidden', backgroundColor: '#C2B0B4', aspectRatio: '63/100', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', cursor: 'pointer' }}
                      title={`${item.customName || item.memberName} - Click or drag to add`}
                    >
                      <img src={item.imageUrl} alt={item.customName} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  {merch.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6A585B' }}>No items match search.</p>}
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}