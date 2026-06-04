import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit, startAfter, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import ThemeAlert from '../ui/ThemeAlert';
import ItemDetailModal from '../ui/ItemDetailModal';
import { deleteCloudinaryImage, uploadToCloudinary } from '../../utils/cloudinaryUtils';
import { useUserProfile } from '../../hooks/useUserProfile';

export default function MemberPage() {
  const { groupId, memberName } = useParams();
  const navigate = useNavigate();
  const { currentUser: user } = useAuth();
  const { profileData } = useUserProfile(user?.uid);
  const canEdit = profileData?.role === 'admin' || profileData?.role === 'collaborator';

  const [data, setData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const [photocards, setPhotocards] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const BATCH_SIZE = 12;

  const [alertMsg, setAlertMsg] = useState(null);
  const [dragging, setDragging] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);

  const fileInputRef = useRef(null);
  const iconInputRef = useRef(null);

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);

        if (groupSnap.exists()) {
          const groupData = groupSnap.data();
          const membersList = groupData.membersData || [];
          const foundMember = membersList.find(m => m.name === memberName);

          const memberDataToSet = foundMember
            ? { ...foundMember, groupName: groupData.name, groupId, groupEras: groupData.eras || [] }
            : { name: memberName, groupName: groupData.name, groupId, groupEras: groupData.eras || [] };

          setData(memberDataToSet);
          setEditForm(memberDataToSet);
          
          // Initial Fetch for items
          fetchItems(memberName, true);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchPageData();
  }, [groupId, memberName]);

  const fetchItems = async (name, isInitial = false) => {
    if (loadingCards) return;
    setLoadingCards(true);
    
    try {
      let q = query(
        collection(db, 'merchandise'), 
        where('memberName', '==', name),
        orderBy('addedAt', 'desc'),
        limit(BATCH_SIZE)
      );
      
      if (!isInitial && lastVisible) {
        q = query(
          collection(db, 'merchandise'), 
          where('memberName', '==', name),
          orderBy('addedAt', 'desc'),
          startAfter(lastVisible), 
          limit(BATCH_SIZE)
        );
      }

      const snap = await getDocs(q);
      const fetchedItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (isInitial) {
        setPhotocards(fetchedItems);
      } else {
        setPhotocards(prev => [...prev, ...fetchedItems]);
      }

      const lastDoc = snap.docs[snap.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(snap.docs.length === BATCH_SIZE);
      
    } catch (e) {
      console.error("Error fetching items:", e);
      // Fallback query without orderBy if index is missing
      if (e.message.includes('index')) {
          console.warn("Missing index for orderBy, falling back to unordered paginated query.");
          let fallbackQ = query(
            collection(db, 'merchandise'), 
            where('memberName', '==', name),
            limit(BATCH_SIZE)
          );
          if (!isInitial && lastVisible) {
             fallbackQ = query(
              collection(db, 'merchandise'), 
              where('memberName', '==', name),
              startAfter(lastVisible), 
              limit(BATCH_SIZE)
            );
          }
          const fallbackSnap = await getDocs(fallbackQ);
          const fbItems = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (isInitial) setPhotocards(fbItems);
          else setPhotocards(prev => [...prev, ...fbItems]);
          setLastVisible(fallbackSnap.docs[fallbackSnap.docs.length - 1] || null);
          setHasMore(fallbackSnap.docs.length === BATCH_SIZE);
      }
    } finally {
      setLoadingCards(false);
    }
  };

  const loadMoreItems = () => {
    if (data && data.name) {
      fetchItems(data.name, false);
    }
  };

  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>Loading...</div>;

  const conceptPhotos = editForm.conceptPhotos || [];
  const handleNextPhoto = () => setCurrentPhotoIndex(prev => (prev === conceptPhotos.length - 1 ? 0 : prev + 1));
  const handlePrevPhoto = () => setCurrentPhotoIndex(prev => (prev === 0 ? conceptPhotos.length - 1 : prev - 1));

  const handlePhotoFiles = (files) => {
    if (!files || files.length === 0) return;
    const newPhotos = Array.from(files).map(file => ({ url: URL.createObjectURL(file), era: 'New Era', file }));
    setEditForm(prev => {
      const updatedPhotos = [...(prev.conceptPhotos || []), ...newPhotos];
      setCurrentPhotoIndex(updatedPhotos.length - 1);
      return { ...prev, conceptPhotos: updatedPhotos };
    });
  };

  const handleIconFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditForm(prev => ({ ...prev, profileImageUrl: URL.createObjectURL(file), profileImageFile: file }));
  };

  const handleDeletePhoto = async () => {
    const updatedPhotos = [...conceptPhotos];
    if (updatedPhotos.length === 0) return;
    const removedPhoto = updatedPhotos.splice(currentPhotoIndex, 1)[0];

    if (removedPhoto?.url?.includes('cloudinary.com')) {
      await deleteCloudinaryImage(removedPhoto.url);
    }

    setEditForm({ ...editForm, conceptPhotos: updatedPhotos });
    setCurrentPhotoIndex(prev => (prev >= updatedPhotos.length ? Math.max(0, updatedPhotos.length - 1) : prev));
  };

  const handleSave = async () => {
    try {
      setAlertMsg("Uploading photos and saving...");

      // Upload profile image if a new file was selected
      const finalProfileImageUrl = editForm.profileImageFile
        ? await uploadToCloudinary(editForm.profileImageFile)
        : editForm.profileImageUrl || '';

      // Upload any new concept photos, keep existing URLs as-is
      const finalPhotos = await Promise.all(
        (editForm.conceptPhotos || []).map(photo =>
          photo.file
            ? uploadToCloudinary(photo.file).then(url => ({ url, era: photo.era }))
            : Promise.resolve(photo)
        )
      );

      const finalSubmission = { ...editForm, profileImageUrl: finalProfileImageUrl, conceptPhotos: finalPhotos };
      delete finalSubmission.profileImageFile;

      const groupRef = doc(db, 'groups', groupId);
      const groupSnap = await getDoc(groupRef);
      const currentMembersData = groupSnap.data().membersData || [];
      const memberIndex = currentMembersData.findIndex(m => m.name === memberName);

      const newMembersData = [...currentMembersData];
      if (memberIndex >= 0) newMembersData[memberIndex] = finalSubmission;
      else newMembersData.push(finalSubmission);

      await updateDoc(groupRef, { membersData: newMembersData });

      setData(finalSubmission);
      setEditForm(finalSubmission);
      setAlertMsg("Member information updated!");
      setIsEditing(false);
    } catch {
      setAlertMsg("Error saving info. Check your connection.");
    }
  };

  const inputStyle = { width: '100%', padding: '0.6rem 1rem', marginBottom: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', boxSizing: 'border-box', color: '#312527', outline: 'none', fontSize: '0.95rem' };
  const arrowStyle = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(49, 37, 39, 0.4)', backdropFilter: 'blur(4px)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'background 0.2s', zIndex: 20 };

  const formatDate = (val) => {
    if (!val) return 'Unknown';
    const parts = val.split('-');
    if (parts.length === 2) return `${parts[1]}/01/${parts[0]}`;
    if (parts.length >= 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return val;
  };

  const officialEras = data.groupEras || [];

  const groupedPhotocards = {};
  photocards.forEach(card => {
    const era = card.era || 'Unknown Era';
    if (!groupedPhotocards[era]) groupedPhotocards[era] = [];
    groupedPhotocards[era].push(card);
  });

  const sortedEras = Object.keys(groupedPhotocards).sort((a, b) => {
    const indexA = officialEras.indexOf(a);
    const indexB = officialEras.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.3s' }}>
      <style>{`
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #8D6E73 !important; }
        .icon-btn:hover { background: rgba(49, 37, 39, 0.7) !important; }
        .del-btn:hover { filter: brightness(0.8); transform: scale(1.05); }
        .merch-card { transition: transform 0.2s ease, box-shadow 0.2s ease !important; }
        .merch-card:hover { transform: translateY(-6px); box-shadow: 0 8px 16px rgba(49, 37, 39, 0.15) !important; z-index: 10; }
        .flip-container { perspective: 1000px; width: 100%; height: 100%; cursor: pointer; aspect-ratio: 63 / 100; }
        .flipper { transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1); transform-style: preserve-3d; position: relative; width: 100%; height: 100%; }
        .flip-container:hover .flipper { transform: rotateY(180deg); }
        .front, .back { backface-visibility: hidden; position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; }
        .back { transform: rotateY(180deg); }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(194,176,180,0.3); border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #A08D90; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }
        .custom-scroll::-webkit-scrollbar-button { display: none; height: 0; }
        .custom-scroll { overflow-y: scroll; scrollbar-gutter: stable; scrollbar-color: #A08D90 rgba(194,176,180,0.3); scrollbar-width: thin; }
        .themed-textarea::-webkit-scrollbar { width: 10px; }
        .themed-textarea::-webkit-scrollbar-track { background: transparent; }
        .themed-textarea::-webkit-scrollbar-thumb { background: #A08D90; border-radius: 6px; border: 2px solid #C2B0B4; }
        .themed-textarea::-webkit-scrollbar-thumb:hover { background: #8D6E73; }
        input[type="date"]::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 0; opacity: 0; cursor: pointer; }
        @media (max-width: 768px) {
          .hero-layout { flex-direction: column !important; height: auto !important; }
          .hero-img-box { min-height: 350px !important; }
          .stats-grid { display: flex !important; flex-direction: column !important; }
          .merch-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; }
          .edit-btn-desktop { display: none !important; }
          .edit-btn-mobile { display: flex !important; }
        }
        @media (min-width: 769px) {
          .edit-btn-mobile { display: none !important; }
        }
      `}</style>

      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} hideButton={alertMsg === "Uploading photos and saving..."} />

      <button type="button" onClick={() => navigate('/artists')} style={{ background: 'none', border: 'none', color: '#6A585B', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', outline: 'none', padding: 0, transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#312527'} onMouseOut={(e) => e.currentTarget.style.color = '#6A585B'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Back to Artists
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="hero-layout" style={{ display: 'flex', gap: '2rem', height: '500px' }}>

          <div className="hero-img-box" style={{ flex: 1, backgroundColor: '#D4C4C7', borderRadius: '12px', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}
               onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (isEditing) setDragging(true); }}>

            {dragging && isEditing && (
              <div
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); if (isEditing && e.dataTransfer.files) handlePhotoFiles(e.dataTransfer.files); }}
                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(141, 110, 115, 0.85)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#FFF', fontSize: '1.2rem', fontWeight: 'bold', border: '4px dashed #FFF', margin: '1rem', borderRadius: '12px' }}>
                Drop photos here
              </div>
            )}

            {canEdit && !isEditing && (
              <button
                className="edit-btn-mobile"
                onClick={() => { setIsEditing(true); setEditForm(data); }}
                style={{ display: 'none', position: 'absolute', right: '1rem', top: '1rem', padding: '0.5rem 1.2rem', backgroundColor: 'rgba(230,218,221,0.85)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '6px', color: '#312527', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap', zIndex: 30, alignItems: 'center' }}
              >
                Edit Profile
              </button>
            )}

            {isEditing && conceptPhotos.length > 0 && (
              <button type="button" className="del-btn" onClick={handleDeletePhoto} style={{ position: 'absolute', top: '15px', right: '15px', backgroundColor: '#6A585B', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', zIndex: 25, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', backdropFilter: 'blur(4px)' }} title="Delete Photo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            )}

            {conceptPhotos.length > 0 ? (
              <>
                <img src={conceptPhotos[currentPhotoIndex].url} alt="Concept" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem 1rem 1rem', background: 'linear-gradient(transparent, rgba(49,37,39,0.85))', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 20 }}>
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <input className="theme-input" value={conceptPhotos[currentPhotoIndex].era} onChange={(e) => { const newPhotos = [...conceptPhotos]; newPhotos[currentPhotoIndex] = { ...newPhotos[currentPhotoIndex], era: e.target.value }; setEditForm({ ...editForm, conceptPhotos: newPhotos }); }} style={{ background: 'transparent', border: 'none', borderBottom: '1px solid white', color: 'white', fontSize: '1rem', fontWeight: 'bold', outline: 'none', padding: '0.2rem', width: '80%' }} />
                    ) : (
                      <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Era: {conceptPhotos[currentPhotoIndex].era}</p>
                    )}
                  </div>
                  {conceptPhotos.length > 1 && <span style={{ fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'rgba(49, 37, 39, 0.6)', padding: '0.3rem 0.7rem', borderRadius: '20px', backdropFilter: 'blur(4px)', marginLeft: '1rem', flexShrink: 0 }}>{currentPhotoIndex + 1} / {conceptPhotos.length}</span>}
                </div>
                {conceptPhotos.length > 1 && (
                  <>
                    <button type="button" className="icon-btn" onClick={handlePrevPhoto} style={{...arrowStyle, left: '10px'}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                    <button type="button" className="icon-btn" onClick={handleNextPhoto} style={{...arrowStyle, right: '10px'}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                  </>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6A585B', padding: '2rem', textAlign: 'center', cursor: isEditing ? 'pointer' : 'default' }} onClick={() => { if (isEditing) fileInputRef.current.click(); }}>
                {isEditing ? "Drag and drop photos here or click to browse!" : "No concept photos available yet."}
              </div>
            )}
          </div>

          <div className="info-panel" style={{ flex: 1, padding: '1rem', paddingBottom: '2rem', display: 'flex', flexDirection: 'column' }}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '2rem' }}>
                  <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                    <div onClick={() => iconInputRef.current.click()} style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#C2B0B4', overflow: 'hidden', border: '3px solid #E6DADD', cursor: 'pointer', position: 'relative' }}>
                      <img src={editForm.profileImageUrl || '/bunny.png'} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#FFF', fontSize: '0.75rem', fontWeight: 'bold' }}><img src="/cam.svg" alt="cam" width="20" height="20" /></div>
                    </div>
                    {editForm.profileImageUrl && (
                      <button type="button" onClick={async () => {
                        if (editForm.profileImageUrl?.includes('cloudinary.com')) {
                          await deleteCloudinaryImage(editForm.profileImageUrl);
                        }
                        setEditForm(prev => ({ ...prev, profileImageUrl: '', profileImageFile: null }));
                      }} className="del-btn" style={{ position: 'absolute', top: '0', right: '0', background: '#312527', opacity: 1, color: '#E6DADD', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Remove Icon">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                  </div>
                  <h3 style={{ margin: 0, color: '#312527', fontSize: '1.6rem' }}>Edit Member</h3>
                  <input ref={iconInputRef} type="file" accept="image/*" onChange={e => { handleIconFile(e); e.target.value = ''; }} style={{ display: 'none' }} />
                </div>

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem' }}>Stage Name</label>
                <input className="theme-input" style={inputStyle} value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem' }}>Hangul Name</label>
                <input className="theme-input" style={inputStyle} value={editForm.hangulName || ''} onChange={e => setEditForm({...editForm, hangulName: e.target.value})} />

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem' }}>Birthday</label>
                <div className="theme-date-picker" style={{ position: 'relative', display: 'flex', alignItems: 'center', backgroundColor: '#C2B0B4', borderRadius: '6px', padding: '0.7rem 1rem', width: '100%', boxSizing: 'border-box', transition: 'box-shadow 0.2s', cursor: 'pointer', marginBottom: '0.8rem' }}>
                  <span style={{ flex: 1, textAlign: 'left', color: '#312527', fontSize: '0.95rem', fontWeight: '500', pointerEvents: 'none' }}>
                    {editForm.birthday ? formatDate(editForm.birthday) : 'MM/DD/YYYY'}
                  </span>
                  <svg style={{ pointerEvents: 'none' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <input type="date" className="theme-input" value={editForm.birthday && editForm.birthday.length === 7 ? editForm.birthday + '-01' : (editForm.birthday || '')} onChange={e => setEditForm({ ...editForm, birthday: e.target.value })} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </div>

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem' }}>Representative Animal</label>
                <input className="theme-input" style={inputStyle} value={editForm.animal || ''} onChange={e => setEditForm({...editForm, animal: e.target.value})} />

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem' }}>Note</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.6rem' }}>
                  <textarea
                    className="themed-textarea theme-input"
                    placeholder="Add a note..."
                    value={editForm.note || ''}
                    onChange={e => setEditForm({...editForm, note: e.target.value})}
                    maxLength={256}
                    style={{ padding: '0.7rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box', minHeight: '100px', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#6A585B', fontWeight: '500' }}>
                    {(editForm.note || '').length}/256
                  </div>
                </div>

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem', marginTop: '1rem' }}>Concept Photos</label>
                <button type="button" onClick={() => fileInputRef.current.click()} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'transparent', border: '2px dashed #A08D90', borderRadius: '6px', color: '#6A585B', cursor: 'pointer', fontWeight: '600' }}>Browse Files (Or Drag to Image)</button>
                <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={e => { handlePhotoFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingBottom: '0.5rem' }}>
                  <button type="button" onClick={handleSave} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
                  <button type="button" onClick={() => { setIsEditing(false); setEditForm(data); }} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', color: '#6A585B', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#C2B0B4', overflow: 'hidden', border: '3px solid #E6DADD', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                      <img src={data.profileImageUrl || '/bunny.png'} alt={data.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, color: '#312527', fontSize: '2.5rem', lineHeight: '1.1' }}>
                        {data.name} <span style={{ fontSize: '1.5rem', color: '#6A585B', fontWeight: '400', marginLeft: '0.4rem' }}>{data.hangulName}</span>
                      </h2>
                      <p
                        onClick={() => navigate(`/groups/${groupId}`)}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#A08D90'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#8D6E73'}
                        style={{ margin: '0.4rem 0 0 0', color: '#8D6E73', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.9rem', cursor: 'pointer', transition: 'color 0.2s ease' }}
                      >
                        {data.groupName}
                      </p>
                    </div>
                  </div>

                  {canEdit && !isEditing && (
                    <button
                      className="edit-btn-desktop"
                      onClick={() => { setIsEditing(true); setEditForm(data); }}
                      style={{ padding: '0.5rem 1.2rem', backgroundColor: 'transparent', border: '2px solid #C2B0B4', borderRadius: '6px', color: '#6A585B', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    >
                      Edit Profile
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#D4C4C7', padding: '1.5rem', borderRadius: '12px', marginTop: '2rem' }}>
                  <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#6A585B', textTransform: 'uppercase', fontWeight: '700' }}>Birthday</p>
                      <p style={{ margin: 0, color: '#312527', fontWeight: '600', fontSize: '1.1rem' }}>{formatDate(data.birthday)}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#6A585B', textTransform: 'uppercase', fontWeight: '700' }}>Rep. Animal</p>
                      <p style={{ margin: 0, color: '#312527', fontSize: '1.8rem' }}>{data.animal || '?'}</p>
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#6A585B', textTransform: 'uppercase', fontWeight: '700' }}>Note</p>
                    <div className="custom-scroll" onWheel={e => { e.stopPropagation(); }} style={{ color: '#312527', fontSize: '0.95rem', fontWeight: '500', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', textAlign: 'left' }}>
                      {data.note || '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isEditing && (
          <div style={{ borderTop: '2px solid #D4C4C7', paddingTop: '2rem' }}>
            <h3 style={{ color: '#312527', fontSize: '1.4rem', marginBottom: '2rem' }}>Cards in Catalog</h3>
            {photocards.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {sortedEras.map(era => (
                  <div key={era}>
                    <h4 style={{ margin: '0 0 1rem 0', paddingLeft: '0.5rem', borderLeft: '4px solid #8D6E73', fontSize: '1.1rem', color: '#8D6E73', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {era} <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '0.85rem', textTransform: 'none' }}>— {groupedPhotocards[era].length} items</span>
                    </h4>
                    <div className="merch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.2rem' }}>
                      {groupedPhotocards[era].map(card => {
                        const isPhotocard = (card.category || "").toLowerCase() === 'photocard';
                        const hasBackprint = isPhotocard && card.backImageUrl;
                        const fitStyle = isPhotocard ? 'cover' : 'contain';
                        const positionStyle = isPhotocard ? 'top' : 'center';
                        const innerBgColor = isPhotocard ? 'transparent' : '#FFFFFF';

                        return (
                          <div key={card.id} className="merch-card" style={{ borderRadius: '12px', backgroundColor: '#D4C4C7', boxShadow: '0 4px 12px rgba(49,37,39,0.1)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <div onClick={() => setSelectedItem(card)} style={{ cursor: 'pointer', width: '100%', aspectRatio: '1 / 1.4', padding: '0.6rem', boxSizing: 'border-box', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {hasBackprint ? (
                                <div className="flip-container" style={{ width: '100%', height: '100%' }}>
                                  <div className="flipper" style={{ width: '100%', height: '100%' }}>
                                    <div className="front" style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                                      <img src={card.imageUrl} alt={card.customName} style={{ width: '100%', height: '100%', objectFit: fitStyle, objectPosition: positionStyle, display: 'block' }} />
                                    </div>
                                    <div className="back" style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                                      <img src={card.backImageUrl} alt={`${card.customName} back`} style={{ width: '100%', height: '100%', objectFit: fitStyle, objectPosition: positionStyle, display: 'block' }} />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: innerBgColor }}>
                                  <img src={card.imageUrl} alt={card.customName} style={{ width: '100%', height: '100%', objectFit: fitStyle, objectPosition: positionStyle, display: 'block' }} />
                                </div>
                              )}
                            </div>

                            <div style={{ padding: '0.2rem 0.6rem 0.8rem 0.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flexGrow: 1, gap: '0.1rem' }}>
                              <span style={{ fontSize: '0.65rem', color: '#8D6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold' }}>{card.category}</span>
                              <h4 style={{ margin: '0.1rem 0 0 0', fontSize: '1.1rem', color: '#312527', fontWeight: '700', cursor: 'pointer', lineHeight: '1.2' }} onClick={() => setSelectedItem(card)}>{card.memberName}</h4>
                              <p style={{ margin: '0 0 0.4rem 0', color: '#6A585B', fontSize: '0.85rem' }}>{card.groupName}{card.era ? ` • ${card.era}` : ''}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {hasMore && (
                  <button 
                    onClick={loadMoreItems} 
                    disabled={loadingCards}
                    style={{ alignSelf: 'center', padding: '0.6rem 2rem', backgroundColor: 'transparent', border: '2px solid #8D6E73', borderRadius: '20px', color: '#8D6E73', cursor: loadingCards ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginTop: '1rem' }}
                  >
                    {loadingCards ? 'Loading...' : 'Load More Cards'}
                  </button>
                )}
              </div>
            ) : (
              <p style={{ color: '#6A585B', fontStyle: 'italic' }}>No photocards logged for this member yet.</p>
            )}
          </div>
        )}
      </div>

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} user={user} />
    </div>
  );
}