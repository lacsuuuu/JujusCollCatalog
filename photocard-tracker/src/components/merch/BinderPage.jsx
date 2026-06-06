import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { deleteField, updateDoc } from 'firebase/firestore';
import { useMerch } from '../../hooks/useMerch';
import { useBinderDragDrop } from '../../hooks/useBinderDragDrop';
import { optimizeUrl } from '../../utils/imageKitUtils';
import ThemeAlert from '../ui/ThemeAlert';

// index.css — add inside @theme and global scope:
//
// @keyframes flipForward {
//   0%   { transform: rotateY(0deg); }
//   100% { transform: rotateY(-180deg); }
// }
// @keyframes flipBack {
//   0%   { transform: rotateY(0deg); }
//   100% { transform: rotateY(180deg); }
// }
//
// @theme {
//   --animate-flip-forward: flipForward 0.7s cubic-bezier(0.645, 0.045, 0.355, 1.000) forwards;
//   --animate-flip-back:    flipBack    0.7s cubic-bezier(0.645, 0.045, 0.355, 1.000) forwards;
// }

// Preloads an array of image URLs, resolves when all are loaded or timeout hits
const preloadImages = (urls, timeoutMs = 800) => {
  const filtered = urls.filter(Boolean);
  if (!filtered.length) return Promise.resolve();
  return Promise.race([
    Promise.all(filtered.map(url => new Promise(resolve => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve; // don't block on broken images
      img.src = url;
    }))),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);
};

const SLOT_STYLES = `
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
    opacity: 0; transition: opacity 0.2s; padding: 0;
  }
  .slot-container:hover .slot-remove-btn { opacity: 1; }
  .merch-picker-item { transition: transform 0.2s; cursor: pointer; }
  .merch-picker-item:hover { transform: scale(1.05); z-index: 5; }
  .custom-scroll::-webkit-scrollbar { width: 8px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }
  .theme-input { transition: box-shadow 0.2s ease; outline: none; }
  .theme-input:focus { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #8D6E73 !important; }
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
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDir, setFlipDir] = useState(null);       // 'forward' | 'back'
  const [pendingPage, setPendingPage] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const { merch } = useMerch(user);

  const isOwner = user?.uid && binder?.userId === user.uid;
  const canEdit = isOwner;

  useEffect(() => {
    if (!binderId) return;
    setPageLoading(true);
    const unsub = onSnapshot(doc(db, 'binders', binderId), async (snap) => {
      if (!snap.exists()) { setNotFound(true); setPageLoading(false); return; }
      const data = { id: snap.id, ...snap.data() };
      if (!data.isPublic && user?.uid !== data.userId) { setIsPrivate(true); setPageLoading(false); return; }
      setBinder(data);
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
        (max, key) => Math.max(max, parseInt(key.split('-')[0], 10) + 1), 1
      )
    );
  }, [binder]);

  const dragDrop = useBinderDragDrop({
    isEditing,
    activeBinder: binder,
    currentPage,
    user,
    onUpdate: (updates) =>
      updateDoc(doc(db, 'binders', binderId), updates).catch(() => setAlertMsg("Error updating binder slots.")),
  });

  const goToPage = async (newPage) => {
    if (newPage === currentPage || isFlipping) return;
    const dir = newPage > currentPage ? 'forward' : 'back';

    // Collect all images that will appear during the flip:
    // - back face of the leaf (what's revealed mid-flip)
    // - destination spread (visible underneath)
    const destLeftPage  = dir === 'forward' ? currentPage  : newPage - 1;
    const destRightPage = newPage;

    const urlsToPreload = [];
    for (let i = 0; i < binder.type; i++) {
      // Leaf back face
      const leafBackId = dir === 'forward'
        ? binder.slots?.[`${currentPage}-${i}`]   // back of current page (showBack)
        : binder.slots?.[`${newPage}-${i}`];       // front of destination page
      const leafBackCard = leafBackId ? merch.find(m => m.id === leafBackId) : null;
      if (leafBackCard) {
        if (dir === 'forward' && leafBackCard.backImageUrl) urlsToPreload.push(optimizeUrl(leafBackCard.backImageUrl));
        if (dir === 'back') urlsToPreload.push(optimizeUrl(leafBackCard.imageUrl));
      }

      // Destination left (back images)
      if (destLeftPage >= 0) {
        const leftId = binder.slots?.[`${destLeftPage}-${i}`];
        const leftCard = leftId ? merch.find(m => m.id === leftId) : null;
        if (leftCard?.backImageUrl) urlsToPreload.push(optimizeUrl(leftCard.backImageUrl));
      }

      // Destination right (front images)
      const rightId = binder.slots?.[`${destRightPage}-${i}`];
      const rightCard = rightId ? merch.find(m => m.id === rightId) : null;
      if (rightCard) urlsToPreload.push(optimizeUrl(rightCard.imageUrl));
    }

    await preloadImages(urlsToPreload);

    setFlipDir(dir);
    setPendingPage(newPage);
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage(newPage);
      setIsFlipping(false);
      setFlipDir(null);
      setPendingPage(null);
    }, 720);
  };

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

  // ── Card grid renderer ───────────────────────────────────
  // showBack: show backImageUrl instead of front
  // interactive: enable drag/drop + remove buttons (right page only)
  const renderGrid = (page, { showBack = false, interactive = false } = {}) => {
    const cols = binder.type === 4 ? 'grid-cols-2' : 'grid-cols-3';
    return (
      <div className={`grid ${cols} gap-3`}>
        {Array.from({ length: binder.type }).map((_, index) => {
          const merchId = binder.slots?.[`${page}-${index}`];
          const card = merchId ? merch.find(m => m.id === merchId) : null;
          const imgUrl = card
            ? (showBack && card.backImageUrl ? optimizeUrl(card.backImageUrl) : optimizeUrl(card.imageUrl))
            : null;
          const isDragTarget = interactive && dragDrop.dragOverSlot === index;
          return (
            <div
              key={index}
              className={`slot-container ${card ? 'filled' : ''} ${interactive && isEditing ? 'editable' : ''} ${isDragTarget ? 'dragging-over' : ''}`}
              draggable={!!(interactive && isEditing && card)}
              onDragStart={(e) => interactive && canEdit && dragDrop.handleSlotDragStart(e, index)}
              onDragOver={(e) => interactive && canEdit && dragDrop.handleDragOver(e, index)}
              onDragLeave={() => interactive && canEdit && dragDrop.handleDragLeave()}
              onDrop={(e) => interactive && canEdit && dragDrop.handleDrop(e, index)}
            >
              {card ? (
                <>
                  <img src={imgUrl} alt={card.customName} draggable="false" className="w-full h-full object-cover" />
                  {interactive && isEditing && canEdit && (
                    <button className="slot-remove-btn" onClick={(e) => { e.stopPropagation(); removeCardFromSlot(index); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </>
              ) : (
                <span className={`text-[#A08D90] text-3xl ${interactive && isEditing ? 'opacity-60' : 'opacity-20'}`}>+</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Loading / error states ───────────────────────────────
  if (pageLoading) return <div className="text-center text-[#6A585B] py-16">Loading binder...</div>;

  if (notFound) return (
    <div className="text-center py-16 px-8">
      <h2 className="text-[#312527] text-2xl font-bold">Binder not found</h2>
      <p className="text-[#6A585B] mt-2">This binder may have been deleted.</p>
      <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 bg-[#8D6E73] text-white rounded-lg font-bold">Go Back</button>
    </div>
  );

  if (isPrivate) return (
    <div className="text-center py-16 px-8">
      <div className="inline-flex mb-6 w-18 h-18 bg-[#D4C4C7] rounded-full items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="text-[#312527] text-2xl font-bold">This binder is private</h2>
      <p className="text-[#6A585B] mt-2 mb-8">Only the owner can view this binder.</p>
      <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#8D6E73] text-white rounded-lg font-bold">Go Back</button>
    </div>
  );

  // ── Spread logic ─────────────────────────────────────────
  // currentPage is the right (front) page; currentPage-1 is the left (back) page
  const leftPage = currentPage - 1;   // -1 = no left page (cover)
  const rightPage = currentPage;

  // During flip, the destination spread sits underneath the animated leaf
  const destLeft  = pendingPage !== null ? (flipDir === 'forward' ? currentPage      : pendingPage - 1) : null;
  const destRight = pendingPage !== null ? (flipDir === 'forward' ? pendingPage       : pendingPage)    : null;

  const spreadMaxW = binder.type === 9 ? 'max-w-[900px]' : binder.type === 4 ? 'max-w-[750px]' : 'max-w-[820px]';

  return (
    <div className="w-full animate-[fadeIn_0.3s]">
      <style>{SLOT_STYLES}</style>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-[rgba(49,37,39,0.6)] flex justify-center items-center z-[9999]">
          <div className="bg-[#E6DADD] p-6 rounded-xl text-center max-w-xs w-[90%]">
            <p className="text-[#312527] font-semibold mb-6 leading-snug">{confirmAction.message}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} className="px-6 py-2 bg-[#8D6E73] text-white rounded-lg font-semibold">Confirm</button>
              <button onClick={() => setConfirmAction(null)} className="px-6 py-2 border border-[#8D6E73] text-[#8D6E73] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full flex justify-between items-center mb-8 flex-wrap gap-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[#6A585B] font-bold bg-transparent border-none cursor-pointer p-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>

        <div className="flex-1 text-center">
          {canEdit && editingName ? (
            <input
              autoFocus className="theme-input bg-[#D4C4C7] border-none rounded-lg text-[#312527] text-2xl font-bold px-4 py-1 text-center"
              value={editNameValue}
              onChange={e => setEditNameValue(e.target.value)}
              onBlur={() => handleRenameSave(editNameValue)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(editNameValue); }}
            />
          ) : (
            <div>
              <h2
                onDoubleClick={() => { if (canEdit) { setEditNameValue(binder.name); setEditingName(true); } }}
                className={`m-0 text-3xl font-bold text-[#312527] ${canEdit ? 'cursor-text' : ''}`}
                title={canEdit ? 'Double click to rename' : ''}
              >
                {binder.name}
              </h2>
              {ownerProfile && !isOwner && (
                <p
                  onClick={() => navigate(`/profile/${binder.userId}`)}
                  className="mt-1 text-sm text-[#8D6E73] cursor-pointer font-semibold hover:opacity-70 transition-opacity"
                >
                  by {ownerProfile.name || 'Unknown'}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 items-center">
          {canEdit && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-5 py-2 border-2 border-[#8D6E73] rounded-lg font-bold text-sm transition-all ${isEditing ? 'bg-[#8D6E73] text-white' : 'bg-transparent text-[#8D6E73]'}`}
              >
                {isEditing ? 'Done Editing' : 'Edit Binder'}
              </button>
              {isEditing && (
                <button onClick={handleDeleteBinder} className="px-4 py-2 border border-[#A85A66] text-[#A85A66] bg-transparent rounded-lg text-sm cursor-pointer">
                  Delete Binder
                </button>
              )}
            </>
          )}
          {!canEdit && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(141,110,115,0.12)] rounded-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              <span className="text-xs text-[#8D6E73] font-bold tracking-widest uppercase">View Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Binder content */}
      <div className={`flex gap-6 items-start ${isEditing ? 'justify-start' : 'justify-center'}`}>
        <div className={`flex flex-col items-center w-full ${spreadMaxW} ${isEditing ? '' : 'mx-auto'}`}>

          {/* Page controls */}
          <div className="flex items-center justify-center relative min-w-[280px] mb-6 bg-[#D4C4C7] px-6 py-2 rounded-full">
            <div className="flex items-center gap-6">
              <button
                onClick={() => goToPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0 || isFlipping}
                className={`p-0 bg-transparent border-none flex ${currentPage === 0 || isFlipping ? 'cursor-not-allowed text-[#C2B0B4]' : 'cursor-pointer text-[#312527]'}`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span className="font-bold text-[#312527] text-base min-w-[95px] text-center">
                Page {currentPage + 1} / {computedTotalPages}
              </span>
              <button
                onClick={() => goToPage(Math.min(computedTotalPages - 1, currentPage + 1))}
                disabled={currentPage >= computedTotalPages - 1 || isFlipping}
                className={`p-0 bg-transparent border-none flex ${currentPage >= computedTotalPages - 1 || isFlipping ? 'cursor-not-allowed text-[#C2B0B4]' : 'cursor-pointer text-[#312527]'}`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
            {canEdit && (
              <button
                onClick={handleSetCover}
                title={binder.coverPage === currentPage ? "Remove Cover Page" : "Set as Cover Page"}
                className={`absolute right-4 p-0 bg-transparent border-none cursor-pointer flex transition-all ${binder.coverPage === currentPage ? 'text-[#8D6E73]' : 'text-[#A08D90]'}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={binder.coverPage === currentPage ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            )}
          </div>

          {/* ── Book spread ── */}
          <div
            className="relative flex w-full rounded-xl"
            style={{
              boxShadow: '0 8px 32px rgba(49,37,39,0.18)',
              perspective: '2000px',
            }}
          >
            {/* Base layer: destination spread (under the leaf while flipping) or current spread */}
            {isFlipping ? (
              <>
                {/* Destination left — back of currentPage (the page just turned) */}
                <div className="flex-1 bg-[#F9F6F0] p-5 rounded-l-xl border-l-[12px] border-[#C2B0B4] border-r border-r-[#D4C4C7] box-border"
                  style={{ boxShadow: '-4px 0 12px rgba(49,37,39,0.08)' }}>
                  {destLeft !== null && destLeft >= 0
                    ? renderGrid(destLeft, { showBack: true })
                    : null}
                </div>
                {/* Spine */}
                <div className="w-2.5 flex-shrink-0 self-stretch"
                  style={{ background: 'linear-gradient(to right, rgba(49,37,39,0.12), rgba(49,37,39,0.04), rgba(49,37,39,0.12))' }} />
                {/* Destination right */}
                <div className="flex-1 bg-[#F9F6F0] p-5 rounded-r-xl border-r-0 box-border"
                  style={{ boxShadow: '4px 0 18px rgba(49,37,39,0.15), inset -8px 0 16px rgba(49,37,39,0.06)' }}>
                  {destRight !== null ? renderGrid(destRight, { interactive: false }) : null}
                </div>
              </>
            ) : (
              <>
                {/* Current left — back of previous page */}
                <div className={`flex-1 bg-[#F9F6F0] p-5 rounded-l-xl border-l-[12px] border-[#C2B0B4] border-r border-r-[#D4C4C7] box-border ${leftPage < 0 ? 'invisible' : ''}`}
                  style={{ boxShadow: '-4px 0 12px rgba(49,37,39,0.08)' }}>
                  {leftPage >= 0 ? renderGrid(leftPage, { showBack: true }) : null}
                </div>
                {/* Spine */}
                <div className="w-2.5 flex-shrink-0 self-stretch"
                  style={{ background: 'linear-gradient(to right, rgba(49,37,39,0.12), rgba(49,37,39,0.04), rgba(49,37,39,0.12))' }} />
                {/* Current right */}
                <div className="flex-1 bg-[#F9F6F0] p-5 rounded-r-xl box-border"
                  style={{ boxShadow: '4px 0 18px rgba(49,37,39,0.15), inset -8px 0 16px rgba(49,37,39,0.06)' }}>
                  {renderGrid(rightPage, { interactive: true })}
                </div>
              </>
            )}

            {/* Turning leaf — animates over the base layer */}
            {isFlipping && (
              <div
                className={`absolute top-0 h-full w-1/2 ${flipDir === 'forward' ? 'right-0 animate-flip-forward' : 'left-0 animate-flip-back'}`}
                style={{
                  transformStyle: 'preserve-3d',
                  // Origin stays on the spine side so the page hinges correctly.
                  // The "swing out from outer edge" feel comes from the easing curve
                  // (slow start = page peels up) rather than changing transform-origin mid-flight,
                  // which would cause a visual jump.
                  transformOrigin: flipDir === 'forward' ? 'left center' : 'right center',
                  zIndex: 10,
                }}
              >
                {/* Front face: the page being lifted away */}
                <div
                  className="absolute inset-0 bg-[#F9F6F0] p-5 overflow-hidden box-border"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    borderRadius: flipDir === 'forward' ? '0 12px 12px 0' : '12px 0 0 12px',
                    boxShadow: flipDir === 'forward'
                      ? '4px 0 18px rgba(49,37,39,0.15)'
                      : '-4px 0 12px rgba(49,37,39,0.08)',
                  }}
                >
                  {flipDir === 'forward'
                    ? renderGrid(rightPage, { interactive: false })        // front of current right page lifts away
                    : renderGrid(leftPage, { showBack: true })             // back of current left page lifts away
                  }
                </div>

                {/* Back face: revealed as leaf crosses 90° */}
                <div
                  className="absolute inset-0 bg-[#F9F6F0] p-5 overflow-hidden box-border"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    borderRadius: flipDir === 'forward' ? '12px 0 0 12px' : '0 12px 12px 0',
                    boxShadow: flipDir === 'forward'
                      ? '-4px 0 12px rgba(49,37,39,0.08)'
                      : '4px 0 18px rgba(49,37,39,0.15)',
                  }}
                >
                  {flipDir === 'forward'
                    ? renderGrid(currentPage, { showBack: true })          // back of the just-turned page becomes new left
                    : renderGrid(pendingPage, { interactive: false })      // front of destination page becomes new right
                  }
                </div>
              </div>
            )}
          </div>

          {/* Bottom page controls (owner only) */}
          {isEditing && canEdit && (
            <div className="flex gap-4 mt-6 w-full justify-center">
              {computedTotalPages > 1 && (
                <button
                  onClick={handleDeletePage}
                  className="px-5 py-2 bg-transparent text-[#A85A66] border-2 border-[#A85A66] rounded-lg font-bold flex items-center gap-1.5 transition-all hover:bg-[#A85A66] hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Remove Page
                </button>
              )}
              <button
                onClick={handleAddPage}
                className="px-5 py-2 bg-[#8D6E73] text-white border-none rounded-lg font-bold flex items-center gap-1.5 transition-all hover:brightness-90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add New Page
              </button>
            </div>
          )}
        </div>

        {/* Collection sidebar (owner edit mode only) */}
        {isEditing && canEdit && (
          <div className="collection-panel flex-1 bg-[#D4C4C7] rounded-xl p-6 flex flex-col h-[calc(100vh-200px)] min-h-[600px] shadow-md" style={{ width: '100%' }}>
            <h3 className="m-0 mb-4 text-[#312527] text-xl font-semibold">Photocards</h3>
            <p className="m-0 mb-4 text-[#6A585B] text-sm italic">Click or drag cards to add them to the binder.</p>
            <input
              className="theme-input w-full px-4 py-3 rounded-lg border-none bg-[#C2B0B4] mb-5 text-[#312527] outline-none box-border"
              placeholder="Search collection..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className="custom-scroll flex-1 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3 pr-2 content-start">
              {merch.filter(m =>
                (m.customName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.memberName || '').toLowerCase().includes(searchQuery.toLowerCase())
              ).map(item => (
                <div
                  key={item.id}
                  className="merch-picker-item rounded-lg overflow-hidden bg-[#C2B0B4] cursor-pointer shadow"
                  style={{ aspectRatio: '63/100' }}
                  draggable
                  onClick={() => handleCollectionClick(item.id)}
                  onDragStart={(e) => dragDrop.handleCollectionDragStart(e, item.id)}
                >
                  <img src={optimizeUrl(item.imageUrl)} alt={item.customName} draggable="false" className="w-full h-full object-cover" />
                </div>
              ))}
              {merch.length === 0 && <p className="col-span-full text-center text-[#6A585B]">No items in collection.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}