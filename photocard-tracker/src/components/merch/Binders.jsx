import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteField } from 'firebase/firestore';
import { useBinders } from '../../hooks/useBinders';
import { useMerch } from '../../hooks/useMerch';
import { useBinderDragDrop } from '../../hooks/useBinderDragDrop';
import ThemeAlert from '../ui/ThemeAlert';
import { optimizeUrl } from '../../utils/imageKitUtils';

const BINDER_STYLES = `
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
  .slot-container.dragging-over { border: 2px solid #8D6E73; background-color: rgba(141,110,115,0.15); transform: scale(1.03); }

  .slot-remove-btn {
    position: absolute; top: 4px; right: 4px;
    background-color: rgba(49,37,39,0.7); border: none; border-radius: 50%;
    width: 24px; height: 24px; cursor: pointer;
    display: flex; justify-content: center; align-items: center;
    opacity: 0; transition: opacity 0.2s, filter 0.2s, transform 0.2s;
    padding: 0; line-height: 0;
  }
  .slot-container:hover .slot-remove-btn { opacity: 1; }
  .slot-remove-btn:hover { filter: brightness(0.8); transform: scale(1.05); }

  .merch-picker-item { transition: transform 0.2s; cursor: pointer; }
  .merch-picker-item:hover { transform: scale(1.05); z-index: 5; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }

  .public-toggle {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.3rem 0.75rem; border-radius: 20px; cursor: pointer;
    font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em;
    text-transform: uppercase; border: none; transition: all 0.2s;
  }
  .public-toggle.is-public { background-color: rgba(141,110,115,0.2); color: #8D6E73; }
  .public-toggle.is-private { background-color: rgba(49,37,39,0.08); color: '#A08D90'; }
  .public-toggle:hover { filter: brightness(0.9); }

  .custom-scroll::-webkit-scrollbar { width: 8px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }

  @media (max-width: 900px) {
    .binder-layout { flex-direction: column !important; }
    .collection-panel { width: 100% !important; max-height: 400px !important; }
  }
`;

export default function Binders({ user }) {
  const navigate = useNavigate();
  const { binders, loading, createBinder, deleteBinder, updateBinder, removeSlotsBatch, togglePublic } = useBinders(user);
  const { merch } = useMerch(user);

  const [activeBinder, setActiveBinder] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newBinderName, setNewBinderName] = useState('');
  const [newBinderType, setNewBinderType] = useState(9);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    if (!activeBinder) return;
    const updated = binders.find(b => b.id === activeBinder.id);
    if (updated) setActiveBinder(updated);
    else setActiveBinder(null);
  }, [binders]);

  const computedTotalPages = useMemo(() => {
    if (!activeBinder) return 1;
    return Math.max(
      activeBinder.totalPages || 1,
      Object.keys(activeBinder.slots || {}).reduce(
        (max, key) => Math.max(max, parseInt(key.split('-')[0], 10) + 1),
        1
      )
    );
  }, [activeBinder]);

  const dragDrop = useBinderDragDrop({
    isEditing,
    activeBinder,
    currentPage,
    user,
    onUpdate: (updates) => updateBinder(activeBinder.id, updates).catch(() => setAlertMsg("Error updating binder slots.")),
  });

  const handleCreateBinder = async () => {
    if (!newBinderName.trim()) return;
    try {
      await createBinder({ name: newBinderName, type: newBinderType });
      setShowCreate(false);
      setNewBinderName('');
      setAlertMsg("Binder created!");
    } catch {
      setAlertMsg("Error creating binder.");
    }
  };

  const handleAddPage = async () => {
    if (!user || !activeBinder) return;
    try {
      await updateBinder(activeBinder.id, { totalPages: computedTotalPages + 1 });
      setCurrentPage(computedTotalPages);
    } catch {
      setAlertMsg("Error adding page.");
    }
  };

  const handleDeletePage = async () => {
    if (!user || !activeBinder) return;

    const hasCards = Array.from({ length: activeBinder.type }, (_, i) =>
      activeBinder.slots?.[`${currentPage}-${i}`]
    ).some(Boolean);

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
      if (activeBinder.coverPage === currentPage) updates.coverPage = null;
      else if (activeBinder.coverPage > currentPage) updates.coverPage = activeBinder.coverPage - 1;
      const newTotal = Math.max(1, computedTotalPages - 1);
      updates.totalPages = newTotal;
      try {
        await removeSlotsBatch(activeBinder.id, updates);
        if (currentPage >= newTotal) setCurrentPage(newTotal - 1);
      } catch {
        setAlertMsg("Error deleting page.");
      }
    };

    if (hasCards) {
      setConfirmAction({
        message: "Are you sure you want to delete this page? Any cards here will be returned to your collection.",
        onConfirm: executeDelete,
      });
    } else {
      await executeDelete();
    }
  };

  const handleCollectionClick = async (merchId) => {
    if (!isEditing || !user) return;
    let emptySlot = -1;
    for (let i = 0; i < activeBinder.type; i++) {
      if (!activeBinder.slots?.[`${currentPage}-${i}`]) { emptySlot = i; break; }
    }
    if (emptySlot === -1) {
      setAlertMsg("This page is full! Add a new page or switch pages.");
      return;
    }
    try {
      await updateBinder(activeBinder.id, { [`slots.${currentPage}-${emptySlot}`]: merchId });
    } catch {
      setAlertMsg("Error adding card.");
    }
  };

  const removeCardFromSlot = async (slotIndex) => {
    try {
      await updateBinder(activeBinder.id, { [`slots.${currentPage}-${slotIndex}`]: deleteField() });
    } catch {
      setAlertMsg("Error removing card.");
    }
  };

  const handleSetCover = async () => {
    const newCover = activeBinder.coverPage === currentPage ? null : currentPage;
    try {
      await updateBinder(activeBinder.id, { coverPage: newCover });
      setAlertMsg(newCover === null ? 'Cover page removed.' : 'Cover updated!');
    } catch {
      setAlertMsg('Error updating cover.');
    }
  };

  const handleDeleteBinder = (id) => {
    setConfirmAction({
      message: "Are you sure you want to delete this binder? Your photocards will remain in your collection.",
      onConfirm: async () => {
        await deleteBinder(id);
        setActiveBinder(null);
        setIsEditing(false);
      },
    });
  };

  const handleRenameSave = async (newName) => {
    if (newName.trim() && newName !== activeBinder.name) {
      await updateBinder(activeBinder.id, { name: newName.trim() });
    }
    setEditingName(false);
  };

  const handleTogglePublic = async (e, binder) => {
    e.stopPropagation();
    try {
      await togglePublic(binder.id, binder.isPublic);
    } catch {
      setAlertMsg("Error updating binder visibility.");
    }
  };

  if (loading && user) return <div style={{ textAlign: 'center', color: '#6A585B', padding: '3rem' }}>Loading binders...</div>;

  // ── Logged-out state ──────────────────────────────────────
  if (!user) {
    return (
      <div style={{ width: '100%' }}>
        <style>{BINDER_STYLES}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', textAlign: 'center', gap: '1.5rem' }}>
          <div style={{ width: '80px', height: '80px', backgroundColor: '#D4C4C7', borderRadius: '12px', borderLeft: '10px solid #C2B0B4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#312527' }}>Log in to Create Your Own Binder</h2>
          <p style={{ margin: 0, color: '#6A585B', fontSize: '0.95rem', maxWidth: '360px' }}>Organize your photocard collection into custom binders. Log in to get started.</p>
          <button
            onClick={() => navigate('/admin')}
            style={{ padding: '0.75rem 2rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.3s' }}>
      <style>{BINDER_STYLES}</style>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

      {/* Confirm modal */}
      {confirmAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49,37,39,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#E6DADD', padding: '1.5rem 2rem', borderRadius: '12px', border: '1px solid #D4C4C7', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '320px', width: '90%' }}>
            <p style={{ color: '#312527', margin: '0 0 1.5rem 0', fontWeight: '600', lineHeight: '1.4' }}>{confirmAction.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8D6E73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Confirm</button>
              <button onClick={() => setConfirmAction(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!activeBinder ? (
        // ── DIRECTORY VIEW ────────────────────────────────────
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527', margin: 0 }}>My Binders</h2>
            <button onClick={() => setShowCreate(true)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              + New Binder
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2.5rem' }}>
            {binders.map(binder => {
              const cardCount = Object.keys(binder.slots || {}).length;
              return (
                <div
                  key={binder.id}
                  className="binder-card"
                  onClick={() => navigate(`/binders/${binder.id}`)}
                  style={{ backgroundColor: '#D4C4C7', borderRadius: '12px', padding: '2rem 1.5rem', boxShadow: '0 4px 12px rgba(49,37,39,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem', position: 'relative' }}
                >
                  {/* Public/Private toggle badge */}
                  <button
                    className={`public-toggle ${binder.isPublic ? 'is-public' : 'is-private'}`}
                    onClick={(e) => handleTogglePublic(e, binder)}
                    style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      backgroundColor: binder.isPublic ? 'rgba(141,110,115,0.2)' : 'rgba(49,37,39,0.08)',
                      color: binder.isPublic ? '#8D6E73' : '#A08D90',
                    }}
                    title={binder.isPublic ? 'Click to make private' : 'Click to make public'}
                  >
                    {binder.isPublic ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    )}
                    {binder.isPublic ? 'Public' : 'Private'}
                  </button>

                  {/* Binder cover preview */}
                  <div style={{ width: '150px', height: '200px', backgroundColor: '#C2B0B4', borderRadius: '6px 16px 16px 6px', borderLeft: '16px solid #8D6E73', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: 'inset 3px 0 6px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: binder.type === 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gridAutoRows: '1fr', gap: '4px', padding: '12px', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                      {Array.from({ length: binder.type }).map((_, i) => {
                        const coverPageNum = binder.coverPage ?? 0;
                        const merchId = binder.slots?.[`${coverPageNum}-${i}`];
                        const card = merchId ? merch.find(m => m.id === merchId) : null;
                        return (
                          <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '3px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {card && <img src={optimizeUrl(card.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable="false" />}
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
            {binders.length === 0 && <p style={{ color: '#6A585B', gridColumn: '1 / -1' }}>No binders yet. Create one to get started!</p>}
          </div>

          {/* Create modal */}
          {showCreate && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(49,37,39,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
              <div style={{ backgroundColor: '#E6DADD', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#312527' }}>Create New Binder</h3>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#6A585B', fontSize: '0.85rem', fontWeight: 'bold' }}>Binder Name</label>
                <input className="theme-input" value={newBinderName} onChange={e => setNewBinderName(e.target.value)} placeholder="e.g., Aespa Collection" style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', marginBottom: '1.5rem', color: '#312527', boxSizing: 'border-box' }} />
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#6A585B', fontSize: '0.85rem', fontWeight: 'bold' }}>Page Layout</label>
                <select value={newBinderType} onChange={e => setNewBinderType(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', marginBottom: '2rem', color: '#312527' }}>
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
        // ── ACTIVE BINDER VIEW ────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button onClick={() => { setActiveBinder(null); setIsEditing(false); }} style={{ background: 'none', border: 'none', color: '#6A585B', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Back
            </button>

            <div style={{ flex: 1, textAlign: 'center' }}>
              {editingName ? (
                <input
                  autoFocus className="theme-input" value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  onBlur={() => handleRenameSave(editNameValue)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(editNameValue); }}
                  style={{ background: '#D4C4C7', border: 'none', borderRadius: '6px', color: '#312527', fontSize: '1.4rem', fontWeight: '700', padding: '0.4rem 1rem', textAlign: 'center' }}
                />
              ) : (
                <h2
                  onDoubleClick={() => { setEditNameValue(activeBinder.name); setEditingName(true); }}
                  style={{ margin: 0, fontSize: '1.6rem', fontWeight: '700', color: '#312527', cursor: 'text' }}
                  title="Double click to rename"
                >
                  {activeBinder.name}
                </h2>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button onClick={() => setIsEditing(!isEditing)} style={{ padding: '0.5rem 1.2rem', backgroundColor: isEditing ? '#8D6E73' : 'transparent', color: isEditing ? '#FFF' : '#8D6E73', border: '2px solid #8D6E73', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}>
                {isEditing ? 'Done Editing' : 'Edit Binder'}
              </button>
              {isEditing && (
                <button onClick={() => handleDeleteBinder(activeBinder.id)} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#A85A66', border: '1px solid #A85A66', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Delete Binder
                </button>
              )}
            </div>
          </div>

          <div className="binder-layout" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', justifyContent: isEditing ? 'flex-start' : 'center' }}>
            <div style={{ flex: isEditing ? '0 0 auto' : '1', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: activeBinder.type === 9 ? '550px' : activeBinder.type === 4 ? '400px' : '500px', margin: isEditing ? '0' : '0 auto' }}>

              {/* Page Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minWidth: '280px', marginBottom: '1.5rem', backgroundColor: '#D4C4C7', padding: '0.5rem 1.5rem', borderRadius: '30px' }}>
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
                <button
                  onClick={handleSetCover}
                  title={activeBinder.coverPage === currentPage ? "Remove Cover Page" : "Set as Cover Page"}
                  style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: activeBinder.coverPage === currentPage ? '#8D6E73' : '#A08D90', display: 'flex', transition: 'all 0.2s', padding: 0 }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill={activeBinder.coverPage === currentPage ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                </button>
              </div>

              {/* Binder Grid */}
              <div style={{ backgroundColor: '#F9F6F0', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 8px 24px rgba(49,37,39,0.15)', width: '100%', borderLeft: '12px solid #C2B0B4', boxSizing: 'border-box' }}>
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: activeBinder.type === 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)' }}>
                  {Array.from({ length: activeBinder.type }).map((_, index) => {
                    const merchId = activeBinder.slots?.[`${currentPage}-${index}`];
                    const card = merchId ? merch.find(m => m.id === merchId) : null;
                    const isDragTarget = dragDrop.dragOverSlot === index;
                    return (
                      <div
                        key={index}
                        className={`slot-container ${card ? 'filled' : ''} ${isEditing ? 'editable' : ''} ${isDragTarget ? 'dragging-over' : ''}`}
                        draggable={!!(isEditing && card)}
                        onDragStart={(e) => dragDrop.handleSlotDragStart(e, index)}
                        onDragOver={(e) => dragDrop.handleDragOver(e, index)}
                        onDragLeave={dragDrop.handleDragLeave}
                        onDrop={(e) => dragDrop.handleDrop(e, index)}
                      >
                        {card ? (
                          <>
                            <img src={optimizeUrl(card.imageUrl)} alt={card.customName} className="slot-image" draggable="false" />
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

              {isEditing && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                  {computedTotalPages > 1 && (
                    <button onClick={handleDeletePage} style={{ padding: '0.6rem 1.2rem', backgroundColor: 'transparent', color: '#A85A66', border: '2px solid #A85A66', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'background 0.2s, color 0.2s' }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#A85A66'; e.currentTarget.style.color = '#FFF'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#A85A66'; }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      Remove Page
                    </button>
                  )}
                  <button onClick={handleAddPage} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'filter 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(0.9)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add New Page
                  </button>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="collection-panel" style={{ flex: 1, backgroundColor: '#D4C4C7', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: '600px', boxShadow: '0 4px 12px rgba(49,37,39,0.1)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#312527', fontSize: '1.2rem' }}>Photocards</h3>
                <p style={{ margin: '0 0 1rem 0', color: '#6A585B', fontSize: '0.85rem', fontStyle: 'italic' }}>Click or drag cards to add them to the binder.</p>
                <input className="theme-input" placeholder="Search collection..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', marginBottom: '1.2rem', color: '#312527', outline: 'none', boxSizing: 'border-box' }} />
                <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.75rem', paddingRight: '0.5rem', alignContent: 'start' }}>
                  {merch.filter(m =>
                    (m.customName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (m.memberName || '').toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(item => (
                    <div key={item.id} className="merch-picker-item" draggable onClick={() => handleCollectionClick(item.id)} onDragStart={(e) => dragDrop.handleCollectionDragStart(e, item.id)} style={{ borderRadius: '6px', overflow: 'hidden', backgroundColor: '#C2B0B4', aspectRatio: '63/100', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', cursor: 'pointer' }} title={`${item.customName || item.memberName} - Click or drag to add`}>
                      <img src={optimizeUrl(item.imageUrl)} alt={item.customName} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  {merch.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6A585B' }}>No items in collection.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}