import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import { deleteCloudinaryImage } from '../../utils/cloudinaryUtils';
import CustomSelect from '../ui/CustomSelect';


const pcTypeOptions = [
  { value: 'Album', label: 'Album' }, { value: 'POB', label: 'POB' },
  { value: 'Merch', label: 'Merch' }, { value: 'LD', label: 'LD' },
  { value: 'Mini', label: 'Mini' }, { value: 'Lenticular', label: 'Lenticular' },
  { value: 'Fansign', label: 'Fansign' }, { value: 'Broadcast', label: 'Broadcast' },
  { value: 'TC', label: 'TC' }, { value: 'Special/Yearbook', label: 'Special / Yearbook' },
  { value: 'True Polaroids', label: 'True Polaroids' }, { value: 'Polaroid-like', label: 'Polaroid-like' }
];

const pcFinishOptions = [
  { value: 'Matte', label: 'Matte' }, { value: 'Glossy', label: 'Glossy' }
];

const statusOptions = [
  { value: 'unowned', label: 'Unowned' },
  { value: 'owned', label: 'Owned' },
  { value: 'on the way', label: 'On the Way' },
  { value: 'wishlisted', label: 'Wishlist' }
];

// Added userRole prop here
export default function ItemDetailModal({ item, onClose, user, userRole }) {
  const navigate = useNavigate();
  const [groupDocId, setGroupDocId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(item);
  const [loading, setLoading] = useState(false);

  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontDragging, setFrontDragging] = useState(false);
  const [backDragging, setBackDragging] = useState(false);

  const frontRef = useRef(null);
  const backRef = useRef(null);

  const isLoggedIn = !!user;

  // ROLE-BASED ACCESS CONTROL LOGIC MOVED HERE:
  const isCreator = item?.userId === user?.uid;
  const role = userRole || 'user'; 
  const isAdmin = role === 'admin';
  const isCollab = role === 'collaborator';
  const canEdit = isAdmin || (isCollab && isCreator);

  useEffect(() => {
    setEditedItem(item);
    setIsEditing(false);
    setFrontFile(null);
    setBackFile(null);
    setGroupDocId(null);
    if (item?.groupName) {
      getDocs(query(collection(db, 'groups'), where('name', '==', item.groupName)))
        .then(snap => { if (!snap.empty) setGroupDocId(snap.docs[0].id); });
    }
  }, [item]);

  useEffect(() => {
    if (item) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [item]);

  if (!item) return null;

  const isPhotocard = (item.category || "").toLowerCase() === 'photocard';

  // ARCHITECTURE UPDATE: isFavorite is now stored in the junction table
  const handleToggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return; // Guard clause just in case
    
    setEditedItem((prev) => {
      const currentFav = !!prev?.isFavorite;
      const newFavState = !currentFav;
      
      if (item?.id) {
        const linkId = `${user.uid}_${item.id}`;
        // Writes to collected_items instead of merchandise
        setDoc(doc(db, "collected_items", linkId), { 
          userId: user.uid,
          merchId: item.id,
          isFavorite: newFavState 
        }, { merge: true })
          .catch((err) => {
            console.error("Failed to update favorite status", err);
            setEditedItem((curr) => ({ ...curr, isFavorite: currentFav }));
          });
      }
      return { ...prev, isFavorite: newFavState };
    });
  };

  const uploadImage = async (file) => {
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
    const compressed = await imageCompression(file, options);
    const formData = new FormData();
    formData.append('file', compressed);
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    formData.append('upload_preset', uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error("Upload failed");
    return data.secure_url;
  };

  const handleRemoveImage = async (fieldToClear, currentUrl) => {
    if (currentUrl && currentUrl.includes('cloudinary.com')) {
      await deleteCloudinaryImage(currentUrl);
    }
    setEditedItem(prev => ({ ...prev, [fieldToClear]: '' }));
    if (fieldToClear === 'imageUrl') setFrontFile(null);
    if (fieldToClear === 'backImageUrl') setBackFile(null);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { status, isFavorite, ...globalItemData } = editedItem;

      let updatedData = { ...globalItemData };
      if (frontFile) updatedData.imageUrl = await uploadImage(frontFile);
      if (backFile) updatedData.backImageUrl = await uploadImage(backFile);

      try {
        await updateDoc(doc(db, "merchandise", item.id), updatedData);
      } catch (err) {
        console.warn("Could not update global item. User likely not the creator.", err);
      }

      const linkId = `${user.uid}_${item.id}`;
      await setDoc(doc(db, "collected_items", linkId), {
        userId: user.uid,
        merchId: item.id,
        status: status || 'unowned',
        updatedAt: new Date()
      }, { merge: true });

      onClose(); 
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  const frontImgSrc = frontFile ? URL.createObjectURL(frontFile) : editedItem?.imageUrl;
  const backImgSrc = backFile ? URL.createObjectURL(backFile) : editedItem?.backImageUrl;

  const formatDateForInput = (val) => {
    if (!val) return '';
    try {
      const d = val.toDate ? val.toDate() : new Date(val);
      if (isNaN(d.getTime())) return '';
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    } catch(e) {
      return '';
    }
  };

  const displayDate = (val) => {
    if (!val) return 'N/A';
    try {
      const d = val.toDate ? val.toDate() : new Date(val);
      if (isNaN(d.getTime())) return 'N/A';
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${month}/${year}`;
    } catch (e) {
      return 'N/A';
    }
  };

  const inputVal = formatDateForInput(editedItem?.releaseDate);
  const displayReleaseDate = inputVal ? `${inputVal.split('-')[1]}/${inputVal.split('-')[0]}` : 'MM/YYYY';

  const hasRequiredImage = !!(frontFile || editedItem?.imageUrl);
  const isSaveDisabled = loading || !hasRequiredImage;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49, 37, 39, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <style>{`
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus, .theme-select-wrapper:focus .theme-select-trigger, .theme-date-picker:focus-within { 
          box-shadow: 0 0 0 2px #E6DADD, 0 0 0 4px #8D6E73 !important; outline: none; border-radius: 6px;
        }

        .modal-scroll::-webkit-scrollbar { width: 10px; }
        .modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .modal-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 6px; }
        .modal-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }
        
        .edit-input { width: 100%; padding: 0.7rem 1rem; background: #C2B0B4; border: none; border-radius: 6px; color: #312527; font-size: 0.95rem; outline: none; transition: box-shadow 0.2s; box-sizing: border-box; text-align: left; fontFamily: inherit; }
        
        .remove-btn { position: absolute; top: 0.5rem; right: 0.5rem; background: #A85A66; border: none; color: #fff; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-weight: bold; z-index: 10; }
        .drop-zone { width: 100%; height: 100%; border: 2px dashed #A08D90; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #6A585B; font-size: 0.85rem; box-sizing: border-box; }
        
        .theme-dropdown-item { padding: 0.5rem 0.75rem; cursor: pointer; color: #312527; font-size: 0.85rem; text-align: left; }
        .theme-dropdown-item:hover { background-color: #8D6E73; color: #FFFFFF; }
        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }

        input[type="month"]::-webkit-calendar-picker-indicator {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          margin: 0; padding: 0; opacity: 0; cursor: pointer;
        }
      `}</style>

      <div className="modal-scroll" style={{ backgroundColor: '#E6DADD', padding: '3rem 2rem 2rem 2rem', borderRadius: '12px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#8D6E73', fontWeight: 'bold' }}>✕</button>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', gap: '1rem', flex: '1.5 1 300px', minWidth: 0, justifyContent: 'center', alignItems: 'center' }}>
            {isPhotocard ? (
              <div style={{ position: 'relative', width: '100%', maxWidth: 'calc(50% - 0.5rem)', aspectRatio: '63 / 100', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#D4C4C7', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                {frontImgSrc ? (
                  <>
                    <img src={frontImgSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {isEditing && <button className="remove-btn" onClick={() => handleRemoveImage('imageUrl', frontImgSrc)}>✕</button>}
                  </>
                ) : (
                  isEditing ? (
                    <div className="drop-zone" style={{ position: 'absolute', inset: 0, border: 'none', borderColor: frontDragging ? '#8D6E73' : '#A08D90', backgroundColor: !hasRequiredImage ? 'rgba(168, 90, 102, 0.1)' : 'transparent' }} onDragOver={e => { e.preventDefault(); setFrontDragging(true); }} onDragLeave={() => setFrontDragging(false)} onDrop={e => { e.preventDefault(); setFrontDragging(false); setFrontFile(e.dataTransfer.files[0]); }} onClick={() => frontRef.current.click()}>
                      <p style={{ color: !hasRequiredImage ? '#A85A66' : '#6A585B', fontWeight: !hasRequiredImage ? 'bold' : 'normal' }}>
                        {isPhotocard ? 'Drop Front Image *' : 'Drop Image *'}
                      </p>
                      <input type="file" ref={frontRef} style={{ display: 'none' }} accept="image/*" onChange={e => setFrontFile(e.target.files[0])} />
                    </div>
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ color: '#8D6E73', fontWeight: '600', margin: 0 }}>No image</p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                {frontImgSrc ? (
                  <>
                    <img src={frontImgSrc} style={{ display: 'block', maxHeight: '50vh', maxWidth: '340px', width: 'auto', height: 'auto' }} />
                    {isEditing && <button className="remove-btn" onClick={() => handleRemoveImage('imageUrl', frontImgSrc)}>✕</button>}
                  </>
                ) : (
                  isEditing ? (
                    <div className="drop-zone" style={{ width: '220px', height: '220px', borderColor: frontDragging ? '#8D6E73' : '#A08D90', backgroundColor: !hasRequiredImage ? 'rgba(168, 90, 102, 0.1)' : 'transparent' }} onDragOver={e => { e.preventDefault(); setFrontDragging(true); }} onDragLeave={() => setFrontDragging(false)} onDrop={e => { e.preventDefault(); setFrontDragging(false); setFrontFile(e.dataTransfer.files[0]); }} onClick={() => frontRef.current.click()}>
                      <p style={{ color: !hasRequiredImage ? '#A85A66' : '#6A585B', fontWeight: !hasRequiredImage ? 'bold' : 'normal' }}>Drop Image *</p>
                      <input type="file" ref={frontRef} style={{ display: 'none' }} accept="image/*" onChange={e => setFrontFile(e.target.files[0])} />
                    </div>
                  ) : (
                    <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ color: '#8D6E73', fontWeight: '600', margin: 0 }}>No image</p>
                    </div>
                  )
                )}
              </div>
            )}

            {isPhotocard && (
              <div style={{ position: 'relative', width: '100%', maxWidth: 'calc(50% - 0.5rem)', aspectRatio: '63 / 100', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#D4C4C7', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                {backImgSrc ? (
                  <>
                    <img src={backImgSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {isEditing && <button className="remove-btn" onClick={() => handleRemoveImage('backImageUrl', backImgSrc)}>✕</button>}
                  </>
                ) : (
                  isEditing ? (
                    <div className="drop-zone" style={{ position: 'absolute', inset: 0, borderColor: backDragging ? '#8D6E73' : '#A08D90', border: 'none' }} onDragOver={e => { e.preventDefault(); setBackDragging(true); }} onDragLeave={() => setBackDragging(false)} onDrop={e => { e.preventDefault(); setBackDragging(false); setBackFile(e.dataTransfer.files[0]); }} onClick={() => backRef.current.click()}>
                      <p>Drop Back Image</p>
                      <input type="file" ref={backRef} style={{ display: 'none' }} accept="image/*" onChange={e => setBackFile(e.target.files[0])} />
                    </div>
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ color: '#8D6E73', fontWeight: '600', margin: 0 }}>No backprint</p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', color: '#8D6E73', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold', margin: '0 0 1rem 0', width: '100%' }}>
              {editedItem?.category || 'N/A'}
            </div>
            
            {isEditing ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <input className="edit-input theme-input" placeholder="Member Name" value={editedItem?.memberName || ''} onChange={e => setEditedItem({...editedItem, memberName: e.target.value})} />
                <input className="edit-input theme-input" placeholder="Group Name" value={editedItem?.groupName || ''} onChange={e => setEditedItem({...editedItem, groupName: e.target.value})} />
                <input className="edit-input theme-input" placeholder="Item Name" value={editedItem?.customName || ''} onChange={e => setEditedItem({...editedItem, customName: e.target.value})} />
                <input className="edit-input theme-input" placeholder="Era" value={editedItem?.era || ''} onChange={e => setEditedItem({...editedItem, era: e.target.value})} />

                <div className="theme-date-picker" style={{ position: 'relative', display: 'flex', alignItems: 'center', backgroundColor: '#C2B0B4', borderRadius: '6px', padding: '0.7rem 1rem', width: '100%', boxSizing: 'border-box', transition: 'box-shadow 0.2s', cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.95rem', color: '#6A585B', pointerEvents: 'none' }}>Release Date:</span>
                  <span style={{ flex: 1, textAlign: 'center', color: '#312527', fontSize: '0.95rem', fontWeight: '500', pointerEvents: 'none' }}>{displayReleaseDate}</span>
                  <svg style={{ pointerEvents: 'none' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <input type="month" value={inputVal} onChange={e => setEditedItem({...editedItem, releaseDate: e.target.value ? new Date(e.target.value + '-01T12:00:00Z') : ''})} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </div>
                
                {isPhotocard && (
                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                    <CustomSelect options={pcTypeOptions} value={editedItem?.photocardType} onChange={val => setEditedItem({...editedItem, photocardType: val})} placeholder="Type" style={{ flex: 1 }} />
                    <CustomSelect options={pcFinishOptions} value={editedItem?.photocardFinish} onChange={val => setEditedItem({...editedItem, photocardFinish: val})} placeholder="Finish" style={{ flex: 1 }} />
                  </div>
                )}

                <CustomSelect options={statusOptions} value={editedItem?.status || 'unowned'} onChange={val => setEditedItem({...editedItem, status: val})} placeholder="Status" />

                <textarea 
                  className="theme-input custom-scroll" 
                  placeholder="Notes / Comments" 
                  value={editedItem?.comments || ''} 
                  onChange={e => setEditedItem({...editedItem, comments: e.target.value})} 
                  style={{ 
                    resize: 'none', height: '110px', width: '100%', padding: '0.7rem 1rem',
                    backgroundColor: '#C2B0B4', border: 'none', borderRadius: '6px',
                    color: '#312527', fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box'
                  }} 
                />
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2
                    onClick={() => groupDocId && editedItem?.memberName && navigate(`/artist/${groupDocId}/${editedItem.memberName}`)}
                    style={{ margin: 0, padding: 0, fontSize: '2.5rem', color: '#312527', lineHeight: '1', fontWeight: '500', wordBreak: 'break-word', cursor: groupDocId && editedItem?.memberName ? 'pointer' : 'default', transition: 'color 0.15s' }}
                    onMouseEnter={e => { if (groupDocId) e.currentTarget.style.color = '#8D6E73'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#312527'; }}
                  >{editedItem?.memberName || 'N/A'}</h2>
                  {isLoggedIn ? (
                    <button 
                      onClick={handleToggleFavorite}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', outline: 'none' }}
                      title={editedItem?.isFavorite ? "Unfavorite" : "Favorite"}
                    >
                      {editedItem?.isFavorite ? (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="#A85A66" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 2px 4px rgba(168,90,102,0.3))', transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.15)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A85A66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" style={{ transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.15)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                      )}
                    </button>
                  ) : (
                    editedItem?.isFavorite && (
                      <div style={{ display: 'flex', alignItems: 'center' }} title="Favorited">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="#A85A66" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 2px 4px rgba(168,90,102,0.3))' }}>
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      </div>
                    )
                  )}
                </div>
                <h3
                  onClick={() => groupDocId && navigate(`/groups/${groupDocId}`)}
                  style={{ margin: '0.4rem 0 1.2rem 0', padding: 0, fontSize: '1.2rem', color: '#8D6E73', fontWeight: '600', cursor: groupDocId ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => { if (groupDocId) e.currentTarget.style.opacity = '0.7'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >{editedItem?.groupName || 'N/A'}</h3>
                
                <p style={{ margin: '0 0 0.4rem 0', padding: 0, color: '#6A585B', fontSize: '0.95rem' }}><strong>Item Name:</strong> {editedItem?.customName || 'N/A'}</p>
                <p style={{ margin: '0 0 0.4rem 0', padding: 0, color: '#6A585B', fontSize: '0.95rem' }}><strong>Era:</strong> {editedItem?.era || 'N/A'}</p>
                <p style={{ margin: '0 0 0.4rem 0', padding: 0, color: '#6A585B', fontSize: '0.95rem' }}><strong>Release Date:</strong> {displayDate(editedItem?.releaseDate)}</p>
                
                {isPhotocard && (
                  <p style={{ margin: '0 0 0.4rem 0', padding: 0, color: '#6A585B', fontSize: '0.95rem' }}>
                    <strong>Details:</strong> {(editedItem?.photocardType || editedItem?.photocardFinish) ? `${editedItem.photocardType || 'N/A'} ${editedItem.photocardFinish ? `(${editedItem.photocardFinish})` : ''}` : 'N/A'}
                  </p>
                )}

                {editedItem?.comments && (
                  <div style={{ marginTop: '1.2rem', padding: '0.75rem 1rem', backgroundColor: '#F9F6F0', borderRadius: '8px', borderLeft: '4px solid #8D6E73', width: '100%', boxSizing: 'border-box' }}>
                    <p style={{ margin: 0, color: '#6A585B', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: '1.4' }}>
                      "{editedItem.comments}"
                    </p>
                  </div>
                )}

                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', backgroundColor: '#D4C4C7', padding: '0.4rem 1.2rem', borderRadius: '30px', gap: '0.5rem' }}>
                  <span style={{ margin: 0, padding: 0, fontSize: '0.8rem', color: '#6A585B', fontWeight: 'bold' }}>STATUS:</span>
                  <span style={{ margin: 0, padding: 0, fontSize: '0.9rem', color: '#312527', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {editedItem?.status || 'Unowned'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
          {isEditing ? (
            <>
              <button onClick={() => { setIsEditing(false); setEditedItem(item); setFrontFile(null); setBackFile(null); }} style={{ padding: '0.5rem 1.5rem', background: 'transparent', border: '1px solid #8D6E73', color: '#8D6E73', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={isSaveDisabled} 
                title={!hasRequiredImage ? "An image is required to save" : ""}
                style={{ 
                  padding: '0.5rem 1.5rem', 
                  background: isSaveDisabled ? '#C2B0B4' : '#8D6E73', 
                  color: isSaveDisabled ? '#6A585B' : '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: isSaveDisabled ? 'not-allowed' : 'pointer', 
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}>
                {loading ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            canEdit && <button onClick={() => setIsEditing(true)} style={{ padding: '0.5rem 1.5rem', background: '#8D6E73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Edit Item</button>
          )}
        </div>
      </div>
    </div>
  );
}