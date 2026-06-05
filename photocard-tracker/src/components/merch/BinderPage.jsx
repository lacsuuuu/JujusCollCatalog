import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, onSnapshot, collection } from 'firebase/firestore';
import { deleteField } from 'firebase/firestore';
import { useMerch } from '../../hooks/useMerch';
import { useBinderDragDrop } from '../../hooks/useBinderDragDrop';
import { updateDoc } from 'firebase/firestore';
import { optimizeUrl } from '../../utils/cloudinaryUtils';
import ThemeAlert from '../ui/ThemeAlert';

const PAGE_STYLES = `
  .theme-input { transition: box-shadow 0.2s ease; outline: none; }
  .theme-input:focus { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #8D6E73 !important; }

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
    opacity: 0; transition: opacity 0.2s;
    padding: 0;
  }
  .slot-container:hover .slot-remove-btn { opacity: 1; }

  .merch-picker-item { transition: transform 0.2s; cursor: pointer; }
  .merch-picker-item:hover { transform: scale(1.05); z-index: 5; }

  .custom-scroll::-webkit-scrollbar { width: 8px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }

  @media (max-width: 900px) {
    .binder-layout { flex-direction: column !important; }
    .collection-panel { width: 100% !important; max-height: 400px !important; }
  }
`;

export default function BinderPage({ user }) {
  const { binderId } = useParams();
  const navigate = useNavigate();

  const [binder, setBinder] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const { merch } = useMerch(user);

  const isOwner = user?.uid && binder?.userId === user.uid;
  const canEdit = isOwner;

  // Live listener for the binder doc
  useEffect(() => {
    if (!binderId) return;
    setPageLoading(true);

    const unsub = onSnapshot(doc(db, 'binders', binderId), async (snap) => {
      if (!snap.exists()) {
        setNotFound(true);
        setPageLoading(false);
        return;
      }

      const data = { id: snap.id, ...snap.data() };

      // If private and not the owner, block access
      if (!data.isPublic && user?.uid !== data.userId) {
        setIsPrivate(true);
        setPageLoading(false);
        return;
      }

      setBinder(data);

      // Fetch owner profile for display
      try {
        const profileSnap = await getDoc(doc(db, 'profile', data.userId));
        if (profileSnap.exists()) setOwnerProfile(profileSnap.data());
      } catch { /* silent */ }

      setPageLoading(false);
    });

    return () => unsub();
  }, [binderId, user?.uid]);

  const computedTotalPages = useMemo(() => {
    if (!binder) return 1;
    return Math.max(
      binder.totalPages || 1,
      Object.keys(binder.slots || {}).reduce(
        (max, key) => Math.max(max, parseInt(key.split('-')[0], 10) + 1),
        1
      )
    );
  }, [binder]);

  const dragDrop = useBinderDragDrop({
    isEditing,
    activeBinder: binder,
    currentPage,
    user,
    onUpdate: (updates) =>
      updateDoc(doc(db, 'binders', binderId), updates).catch(() =>
        setAlertMsg("Error updating binder slots.")
      ),
  });

  const handleAddPage = async () => {
    try {
      await updateDoc(doc(db, 'binders', binderId), { totalPages: computedTotalPages + 1 });
      setCurrentPage(computedTotalPages);
    } catch { setAlertMsg("Error adding page."); }
  };

  const handleDeletePage = async () => {
    const hasCards = Array.from({ length: binder.type }, (_, i) =>
      binder.slots?.[`${currentPage}-${i}`]
    ).some(Boolean);

    const executeDelete = async () => {
      const updates = {};
      for (let i = 0; i < binder.type; i++) {
        if (binder.slots?.[`${currentPage}-${i}`]) updates[`slots.${currentPage}-${i}`] = deleteField();
      }
      Object.keys(binder.slots || {}).forEach(key => {
        const [p, s] = key.split('-');
        const pageNum = parseInt(p, 10);
        const slotNum = parseInt(s, 10);
        if (pageNum > currentPage) {
          updates[`slots.${pageNum - 1}-${slotNum}`] = binder.slots[key];
          updates[`slots.${pageNum}-${slotNum}`] = deleteField();
        }
      });
      if (binder.coverPage === currentPage) updates.coverPage = null;
      else if (binder.coverPage > currentPage) updates.coverPage = binder.coverPage - 1;
      const newTotal = Math.max(1, computedTotalPages - 1);
      updates.totalPages = newTotal;
      try {
        await updateDoc(doc(db, 'binders', binderId), updates);
        if (currentPage >= newTotal) setCurrentPage(newTotal - 1);
      } catch { setAlertMsg("Error deleting page."); }
    };

    if (hasCards) {
      setConfirmAction({ message: "Delete this page? Cards will return to your collection.", onConfirm: executeDelete });
    } else {
      await executeDelete();
    }
  };

  const handleCollectionClick = async (merchId) => {
    if (!isEditing) return;
    let emptySlot = -1;
    for (let i = 0; i < binder.type; i++) {
      if (!binder.slots?.[`${currentPage}-${i}`]) { emptySlot = i; break; }
    }
    if (emptySlot === -1) { setAlertMsg("This page is full!"); return; }
    try {
      await updateDoc(doc(db, 'binders', binderId), { [`slots.${currentPage}-${emptySlot}`]: merchId });
    } catch { setAlertMsg("Error adding card."); }
  };

  const removeCardFromSlot = async (slotIndex) => {
    try {
      await updateDoc(doc(db, 'binders', binderId), { [`slots.${currentPage}-${slotIndex}`]: deleteField() });
    } catch { setAlertMsg("Error removing card."); }
  };

  const handleSetCover = async () => {
    const newCover = binder.coverPage === currentPage ? null : currentPage;
    try {
      await updateDoc(doc(db, 'binders', binderId), { coverPage: newCover });
    } catch { setAlertMsg("Error updating cover."); }
  };

  const handleRenameSave = async (newName) => {
    if (newName.trim() && newName !== binder.name) {
      await updateDoc(doc(db, 'binders', binderId), { name: newName.trim() });
    }
    setEditingName(false);
  };

  const handleDeleteBinder = () => {
    setConfirmAction({
      message: "Delete this binder? Your photocards will remain in your collection.",
      onConfirm: async () => {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'binders', binderId));
        navigate('/binders');
      },
    });
  };

  // ── Loading state ────────────────────────────────────────
  if (pageLoading) {
    return (
      <div style={{ textAlign: 'center', color: '#6A585B', padding: '4rem' }}>
        Loading binder...
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2 style={{ color: '#312527' }}>Binder not found</h2>
        <p style={{ color: '#6A585B' }}>This binder may have been deleted.</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: '1rem', padding: '0.6rem 1.5rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Go Back</button>
      </div>
    );
  }

  // ── Private ──────────────────────────────────────────────
  if (isPrivate) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ display: 'inline-flex', marginBottom: '1.5rem', width: '72px', height: '72px', backgroundColor: '#D4C4C7', borderRadius: '50%', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 style={{ color: '#312527', margin: '0 0 0.5rem 0' }}>This binder is private</h2>
        <p style={{ color: '#6A585B', margin: '0 0 2rem 0' }}>Only the owner can view this binder.</p>
        <button onClick={() => navigate(-1)} style={{ padding: '0.6rem 1.5rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.3s' }}>
      <style>{PAGE_STYLES}</style>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

      {/* Confirm modal */}
      {confirmAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49,37,39,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#E6DADD', padding: '1.5rem 2rem', borderRadius: '12px', textAlign: 'center', maxWidth: '320px', width: '90%' }}>
            <p style={{ color: '#312527', margin: '0 0 1.5rem 0', fontWeight: '600', lineHeight: '1.4' }}>{confirmAction.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8D6E73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Confirm</button>
              <button onClick={() => setConfirmAction(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#6A585B', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Back
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          {canEdit && editingName ? (
            <input
              autoFocus className="theme-input" value={editNameValue}
              onChange={e => setEditNameValue(e.target.value)}
              onBlur={() => handleRenameSave(editNameValue)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(editNameValue); }}
              style={{ background: '#D4C4C7', border: 'none', borderRadius: '6px', color: '#312527', fontSize: '1.4rem', fontWeight: '700', padding: '0.4rem 1rem', textAlign: 'center' }}
            />
          ) : (
            <div>
              <h2
                onDoubleClick={() => { if (canEdit) { setEditNameValue(binder.name); setEditingName(true); } }}
                style={{ margin: 0, fontSize: '1.6rem', fontWeight: '700', color: '#312527', cursor: canEdit ? 'text' : 'default' }}
                title={canEdit ? 'Double click to rename' : ''}
              >
                {binder.name}
              </h2>
              {ownerProfile && !isOwner && (
                <p
                  onClick={() => navigate(`/profile/${binder.userId}`)}
                  style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#8D6E73', cursor: 'pointer', fontWeight: '600' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.7}
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}
                >
                  by {ownerProfile.name || 'Unknown'}
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {canEdit && (
            <>
              <button onClick={() => setIsEditing(!isEditing)} style={{ padding: '0.5rem 1.2rem', backgroundColor: isEditing ? '#8D6E73' : 'transparent', color: isEditing ? '#FFF' : '#8D6E73', border: '2px solid #8D6E73', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}>
                {isEditing ? 'Done Editing' : 'Edit Binder'}
              </button>
              {isEditing && (
                <button onClick={handleDeleteBinder} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#A85A66', border: '1px solid #A85A66', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Delete Binder
                </button>
              )}
            </>
          )}
          {!canEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', backgroundColor: 'rgba(141,110,115,0.12)', borderRadius: '20px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span style={{ fontSize: '0.8rem', color: '#8D6E73', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>View Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Binder content */}
      <div className="binder-layout" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', justifyContent: isEditing ? 'flex-start' : 'center' }}>
        <div style={{ flex: isEditing ? '0 0 auto' : '1', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: binder.type === 9 ? '550px' : binder.type === 4 ? '400px' : '500px', margin: isEditing ? '0' : '0 auto' }}>

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
            {canEdit && (
              <button onClick={handleSetCover} title={binder.coverPage === currentPage ? "Remove Cover Page" : "Set as Cover Page"} style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: binder.coverPage === currentPage ? '#8D6E73' : '#A08D90', display: 'flex', transition: 'all 0.2s', padding: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill={binder.coverPage === currentPage ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
            )}
          </div>

          {/* Binder Grid */}
          <div style={{ backgroundColor: '#F9F6F0', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 8px 24px rgba(49,37,39,0.15)', width: '100%', borderLeft: '12px solid #C2B0B4', boxSizing: 'border-box' }}>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: binder.type === 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)' }}>
              {Array.from({ length: binder.type }).map((_, index) => {
                const merchId = binder.slots?.[`${currentPage}-${index}`];
                const card = merchId ? merch.find(m => m.id === merchId) : null;
                const isDragTarget = dragDrop.dragOverSlot === index;
                return (
                  <div
                    key={index}
                    className={`slot-container ${card ? 'filled' : ''} ${isEditing ? 'editable' : ''} ${isDragTarget ? 'dragging-over' : ''}`}
                    draggable={!!(isEditing && card)}
                    onDragStart={(e) => canEdit && dragDrop.handleSlotDragStart(e, index)}
                    onDragOver={(e) => canEdit && dragDrop.handleDragOver(e, index)}
                    onDragLeave={() => canEdit && dragDrop.handleDragLeave()}
                    onDrop={(e) => canEdit && dragDrop.handleDrop(e, index)}
                  >
                    {card ? (
                      <>
                        <img src={optimizeUrl(card.imageUrl)} alt={card.customName} className="slot-image" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {isEditing && canEdit && (
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

          {/* Bottom page controls (owner only) */}
          {isEditing && canEdit && (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
              {computedTotalPages > 1 && (
                <button onClick={handleDeletePage} style={{ padding: '0.6rem 1.2rem', backgroundColor: 'transparent', color: '#A85A66', border: '2px solid #A85A66', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'background 0.2s, color 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor = '#A85A66'; e.currentTarget.style.color = '#FFF'; }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#A85A66'; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Remove Page
                </button>
              )}
              <button onClick={handleAddPage} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'filter 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.filter = 'brightness(0.9)'; }}
                onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)'; }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add New Page
              </button>
            </div>
          )}
        </div>

        {/* Collection sidebar (owner edit mode only) */}
        {isEditing && canEdit && (
          <div className="collection-panel" style={{ flex: 1, backgroundColor: '#D4C4C7', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: '600px', boxShadow: '0 4px 12px rgba(49,37,39,0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#312527', fontSize: '1.2rem' }}>Photocards</h3>
            <p style={{ margin: '0 0 1rem 0', color: '#6A585B', fontSize: '0.85rem', fontStyle: 'italic' }}>Click or drag cards to add them to the binder.</p>
            <input className="theme-input" placeholder="Search collection..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', marginBottom: '1.2rem', color: '#312527', outline: 'none', boxSizing: 'border-box' }} />
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.75rem', paddingRight: '0.5rem', alignContent: 'start' }}>
              {merch.filter(m =>
                (m.customName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.memberName || '').toLowerCase().includes(searchQuery.toLowerCase())
              ).map(item => (
                <div key={item.id} className="merch-picker-item" draggable onClick={() => handleCollectionClick(item.id)} onDragStart={(e) => dragDrop.handleCollectionDragStart(e, item.id)} style={{ borderRadius: '6px', overflow: 'hidden', backgroundColor: '#C2B0B4', aspectRatio: '63/100', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
                  <img src={optimizeUrl(item.imageUrl)} alt={item.customName} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
              {merch.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6A585B' }}>No items in collection.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}