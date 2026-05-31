import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import ThemeAlert from './ThemeAlert';
import { deleteCloudinaryImage } from '../utils/cloudinaryUtils';

export default function GroupPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [merch, setMerch] = useState([]);
  const [alertMsg, setAlertMsg] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [memberPage, setMemberPage] = useState(0);
  const membersPerPage = 6;
  const [user, setUser] = useState(null); 

  const fileInputRef = useRef(null);
  const iconInputRef = useRef(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const fetchData = async () => {
      try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const d = { id: groupSnap.id, ...groupSnap.data() };
          setData(d);
          setEditForm(d);
        }
        const q = query(collection(db, 'merchandise'), where('groupName', '==', groupSnap.data()?.name));
        const snap = await getDocs(q);
        setMerch(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();

    return () => unsubAuth();
  }, [groupId]);

  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>Loading...</div>;

  const conceptPhotos = editForm.conceptPhotos || [];
  const handleNextPhoto = () => setCurrentPhotoIndex(p => (p === conceptPhotos.length - 1 ? 0 : p + 1));
  const handlePrevPhoto = () => setCurrentPhotoIndex(p => (p === 0 ? conceptPhotos.length - 1 : p - 1));

  const handlePhotoFiles = (files) => {
    if (!files || files.length === 0) return;
    const newPhotos = Array.from(files).map(file => ({ url: URL.createObjectURL(file), era: 'New Era', file }));
    setEditForm(prev => ({ ...prev, conceptPhotos: [...(prev.conceptPhotos || []), ...newPhotos] }));
  };

  const handleIconFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditForm(prev => ({ ...prev, groupImageUrl: URL.createObjectURL(file), groupImageFile: file }));
  };

  const handleDeletePhoto = async () => {
    const updatedPhotos = [...(editForm.conceptPhotos || [])];
    if (updatedPhotos.length === 0) return;
    const removedPhoto = updatedPhotos.splice(currentPhotoIndex, 1)[0];
    
    if (removedPhoto && removedPhoto.url && removedPhoto.url.includes('cloudinary.com')) {
      await deleteCloudinaryImage(removedPhoto.url);
    }

    setEditForm(prev => ({ ...prev, conceptPhotos: updatedPhotos }));
    setCurrentPhotoIndex(p => (p >= updatedPhotos.length ? Math.max(0, updatedPhotos.length - 1) : p));
  };

  const handleSave = async () => {
    try {
      setAlertMsg("Uploading and saving...");

      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

      let finalGroupImageUrl = editForm.groupImageUrl || '';
      if (editForm.groupImageFile) {
        const fd = new FormData();
        fd.append('file', editForm.groupImageFile);
        fd.append('upload_preset', uploadPreset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
        const uploadData = await res.json();
        if (uploadData.secure_url) finalGroupImageUrl = uploadData.secure_url;
        else throw new Error("Icon upload failed");
      }

      let finalPhotos = [];
      for (const photo of (editForm.conceptPhotos || [])) {
        if (photo.file) {
          const fd = new FormData();
          fd.append('file', photo.file);
          fd.append('upload_preset', uploadPreset);
          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
          const uploadData = await res.json();
          if (uploadData.secure_url) finalPhotos.push({ url: uploadData.secure_url, era: photo.era });
          else throw new Error("Photo upload failed");
        } else {
          finalPhotos.push(photo);
        }
      }

      const finalSubmission = { ...editForm, groupImageUrl: finalGroupImageUrl, conceptPhotos: finalPhotos };
      delete finalSubmission.groupImageFile;

      await updateDoc(doc(db, 'groups', groupId), finalSubmission);
      setData(finalSubmission);
      setAlertMsg("Group info updated!");
      setIsEditing(false);
    } catch (e) {
      setAlertMsg("Error saving. Check your connection.");
    }
  };

  const inputStyle = {
    width: '100%', padding: '0.6rem 1rem', marginBottom: '0.8rem',
    borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4',
    boxSizing: 'border-box', color: '#312527', outline: 'none', fontSize: '0.95rem',
  };

  const arrowStyle = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(49,37,39,0.4)', backdropFilter: 'blur(4px)',
    color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px',
    cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
    transition: 'background 0.2s',
  };

  const formatMonthYear = (val) => {
    if (!val) return 'Unknown';
    const parts = val.split('-');
    if (parts.length < 2) return val;
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.3s' }}>
      <style>{`
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #8D6E73 !important; }
        .icon-btn:hover { background: rgba(49,37,39,0.7) !important; }
        .del-btn:hover { filter: brightness(0.8); transform: scale(1.05); }
        .merch-card { transition: transform 0.2s ease, box-shadow 0.2s ease !important; }
        .merch-card:hover { transform: translateY(-6px); box-shadow: 0 8px 16px rgba(49,37,39,0.15) !important; }
        .flip-container { perspective: 1000px; width: 100%; height: 100%; cursor: pointer; }
        .flipper { transition: transform 0.6s cubic-bezier(0.4,0.0,0.2,1); transform-style: preserve-3d; position: relative; width: 100%; height: 100%; }
        .flip-container:hover .flipper { transform: rotateY(180deg); }
        .front, .back { backface-visibility: hidden; position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; }
        .back { transform: rotateY(180deg); }
        .themed-textarea::-webkit-scrollbar { width: 10px; }
        .themed-textarea::-webkit-scrollbar-track { background: transparent; }
        .themed-textarea::-webkit-scrollbar-thumb { background: #A08D90; border-radius: 6px; border: 2px solid #C2B0B4; }
        .themed-textarea::-webkit-scrollbar-thumb:hover { background: #8D6E73; }
        input[type="month"]::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 0; opacity: 0; cursor: pointer; }

        @media (max-width: 768px) {
          .hero-layout { flex-direction: column !important; height: auto !important; }
          .hero-img-box { min-height: 350px !important; }
          .hero-header { flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 1rem !important; }
          .hero-title-row { flex-direction: column !important; justify-content: center !important; gap: 0.8rem !important; }
          .stats-grid { grid-template-columns: 1fr !important; }
          .member-grid { flex-wrap: wrap !important; justify-content: center !important; }
          .edit-btn-desktop { display: none !important; }
          .edit-btn-mobile { display: flex !important; }
        }
        @media (min-width: 769px) {
          .edit-btn-mobile { display: none !important; }
        }
      `}</style>

      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} hideButton={alertMsg === "Uploading and saving..."} />

      <button
        onClick={() => navigate('/groups')}
        style={{ background: 'none', border: 'none', color: '#6A585B', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', outline: 'none', padding: 0, transition: 'color 0.2s' }}
        onMouseOver={e => e.currentTarget.style.color = '#312527'}
        onMouseOut={e => e.currentTarget.style.color = '#6A585B'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Back to Groups
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="hero-layout" style={{ display: 'flex', gap: '2rem', height: '500px' }}>

          <div
            style={{ flex: 1, backgroundColor: '#D4C4C7', borderRadius: '12px', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}
            onDragOver={e => { e.preventDefault(); if (isEditing) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); if (isEditing) handlePhotoFiles(e.dataTransfer.files); }}
          >
            {dragging && isEditing && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(141,110,115,0.85)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#FFF', fontSize: '1.2rem', fontWeight: 'bold', border: '4px dashed #FFF', margin: '1rem', borderRadius: '12px', pointerEvents: 'none' }}>
                Drop photos here
              </div>
            )}

            {user && !isEditing && (
              <button
                className="edit-btn-mobile"
                onClick={() => setIsEditing(true)}
                style={{ display: 'none', position: 'absolute', right: '1rem', top: '1rem',
                  padding: '0.5rem 1.2rem', backgroundColor: 'rgba(230,218,221,0.85)',
                  backdropFilter: 'blur(4px)', border: 'none', borderRadius: '6px',
                  color: '#312527', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                  whiteSpace: 'nowrap', zIndex: 30, alignItems: 'center' }}
              >
                Edit Profile
              </button>
            )}

            {isEditing && conceptPhotos.length > 0 && (
              <button className="del-btn" onClick={handleDeletePhoto}
                style={{ position: 'absolute', top: '15px', right: '15px', backgroundColor: '#6A585B', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', zIndex: 5, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s' }}
                title="Delete Photo"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            )}

            {conceptPhotos.length > 0 ? (
              <>
                <img src={conceptPhotos[currentPhotoIndex].url} alt="Group" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem 1rem 1rem', background: 'linear-gradient(transparent, rgba(49,37,39,0.85))', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <input className="theme-input"
                        value={conceptPhotos[currentPhotoIndex].era}
                        onChange={e => {
                          const newPhotos = [...conceptPhotos];
                          newPhotos[currentPhotoIndex].era = e.target.value;
                          setEditForm({ ...editForm, conceptPhotos: newPhotos });
                        }}
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid white', color: 'white', fontSize: '1rem', fontWeight: 'bold', outline: 'none', padding: '0.2rem', width: '80%' }}
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Era: {conceptPhotos[currentPhotoIndex].era}</p>
                    )}
                  </div>
                  {conceptPhotos.length > 1 && (
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'rgba(49,37,39,0.6)', padding: '0.3rem 0.7rem', borderRadius: '20px', backdropFilter: 'blur(4px)', marginLeft: '1rem', flexShrink: 0 }}>
                      {currentPhotoIndex + 1} / {conceptPhotos.length}
                    </span>
                  )}
                </div>
                {conceptPhotos.length > 1 && (
                  <>
                    <button className="icon-btn" onClick={handlePrevPhoto} style={{ ...arrowStyle, left: '10px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button className="icon-btn" onClick={handleNextPhoto} style={{ ...arrowStyle, right: '10px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6A585B', padding: '2rem', textAlign: 'center' }}>
                {isEditing ? 'Drag and drop photos here!' : 'No group photos yet.'}
              </div>
            )}
          </div>

          <div style={{ flex: 1, padding: '1rem', paddingBottom: '2rem' }}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '2rem' }}>
                  <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                    <div
                      onClick={() => iconInputRef.current.click()}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#C2B0B4', overflow: 'hidden', border: '3px solid #E6DADD', cursor: 'pointer', position: 'relative' }}
                    >
                      <img src={editForm.groupImageUrl || '/bunny.png'} alt="Group" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img src="/cam.svg" alt="cam" width="20" height="20" />
                      </div>
                    </div>
                    {editForm.groupImageUrl && (
                      <button onClick={async () => {
                        if (editForm.groupImageUrl?.includes('cloudinary.com')) {
                          await deleteCloudinaryImage(editForm.groupImageUrl);
                        }
                        setEditForm(p => ({ ...p, groupImageUrl: '', groupImageFile: null }));
                      }}
                        className="del-btn"
                        style={{ position: 'absolute', top: 0, right: 0, background: '#312527', color: '#E6DADD', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        title="Remove Icon"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                  <h3 style={{ margin: 0, color: '#312527', fontSize: '1.6rem' }}>Edit Group</h3>
                  <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconFile} style={{ display: 'none' }} />
                </div>

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem' }}>Group Name</label>
                <input className="theme-input" style={inputStyle} value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem' }}>Fandom Name</label>
                <input className="theme-input" style={inputStyle} value={editForm.fandomName || ''} onChange={e => setEditForm({ ...editForm, fandomName: e.target.value })} />

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem' }}>Debut Date</label>
                <div className="theme-date-picker" style={{ position: 'relative', display: 'flex', alignItems: 'center', backgroundColor: '#C2B0B4', borderRadius: '6px', padding: '0.7rem 1rem', width: '100%', boxSizing: 'border-box', transition: 'box-shadow 0.2s', cursor: 'pointer' }}>
                  <span style={{ flex: 1, textAlign: 'left', color: '#312527', fontSize: '0.95rem', fontWeight: '500', pointerEvents: 'none' }}>
                    {editForm.debutDate ? `${editForm.debutDate.split('-')[1]}/${editForm.debutDate.split('-')[0]}` : 'MM/YYYY'}
                  </span>
                  <svg style={{ pointerEvents: 'none' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <input type="month" className="theme-input" value={editForm.debutDate || ''} onChange={e => setEditForm({ ...editForm, debutDate: e.target.value })} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </div>

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem', marginTop: '0.4rem' }}>Note</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.6rem' }}>
                  <textarea
                    className="themed-textarea theme-input"
                    placeholder="Add a note..."
                    value={editForm.note || ''}
                    onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                    maxLength={256}
                    style={{ padding: '0.7rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box', minHeight: '100px', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#6A585B', fontWeight: '500' }}>
                    {(editForm.note || '').length}/256
                  </div>
                </div>

                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.3rem', marginTop: '1rem' }}>Concept Photos</label>
                <button onClick={() => fileInputRef.current.click()}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: 'transparent', border: '2px dashed #A08D90', borderRadius: '6px', color: '#6A585B', cursor: 'pointer', fontWeight: '600' }}
                >
                  Browse Files (Or Drag to Image)
                </button>
                <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={e => handlePhotoFiles(e.target.files)} style={{ display: 'none' }} />

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingBottom: '0.5rem' }}>
                  <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
                  <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', color: '#6A585B', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="hero-header" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#C2B0B4', overflow: 'hidden', border: '3px solid #E6DADD', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                    <img src={data.groupImageUrl || '/bunny.png'} alt={data.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  </div>
                  
                  <div style={{ flex: 1, width: '100%' }}>
                    <div className="hero-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, color: '#312527', fontSize: '2.5rem' }}>{data.name}</h2>
                      {user && (
                        <button
                          className="edit-btn-desktop"
                          onClick={() => setIsEditing(true)}
                          style={{ padding: '0.5rem 1.2rem', backgroundColor: 'transparent', border: '2px solid #C2B0B4', borderRadius: '6px', color: '#6A585B', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                        >
                          Edit Profile
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#D4C4C7', padding: '1.5rem', borderRadius: '12px', marginTop: '2rem' }}>
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#6A585B', textTransform: 'uppercase', fontWeight: '700' }}>Debut Date</p>
                    <p style={{ margin: 0, color: '#312527', fontWeight: '600', fontSize: '1.1rem' }}>{formatMonthYear(data.debutDate)}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#6A585B', textTransform: 'uppercase', fontWeight: '700' }}>Fandom</p>
                    <p style={{ margin: 0, color: '#312527', fontWeight: '600', fontSize: '1.1rem' }}>{data.fandomName || '—'}</p>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#6A585B', textTransform: 'uppercase', fontWeight: '700' }}>Total Merch</p>
                    <p style={{ margin: 0, color: '#312527', fontWeight: '600', fontSize: '1.1rem' }}>{merch.length}</p>
                  </div>
                </div>

                {data.note && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#6A585B', textTransform: 'uppercase', fontWeight: '700' }}>Note</p>
                    <div
                      onWheel={e => e.stopPropagation()}
                      style={{ color: '#312527', fontSize: '0.95rem', fontWeight: '500', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#D4C4C7', borderRadius: '8px', padding: '0.75rem 1rem' }}
                    >
                      {data.note}
                    </div>
                  </div>
                )}

                {(() => {
                  const members = data.members || [];
                  const totalPages = Math.ceil(members.length / membersPerPage);
                  const paginated = members.slice(memberPage * membersPerPage, (memberPage + 1) * membersPerPage);
                  return (
                    <div style={{ marginTop: '1.5rem' }}>
                      <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#6A585B', textTransform: 'uppercase', fontWeight: '700' }}>Members</p>
                      <div className="member-grid" style={{ display: 'flex', justifyContent: 'center', gap: '1.2rem', flexWrap: 'nowrap' }}>
                        {paginated.map(memberName => {
                          const richData = (data.membersData || []).find(m => m.name === memberName) || {};
                          return (
                            <div
                              key={memberName}
                              onClick={() => navigate(`/artist/${groupId}/${memberName}`)}
                              style={{ cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', flexShrink: 0 }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                              <div style={{ width: '64px', height: '64px', margin: '0 auto 0.4rem', borderRadius: '50%', backgroundColor: '#C2B0B4', overflow: 'hidden', border: '3px solid #E6DADD', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                                <img src={richData.profileImageUrl || '/bunny.png'} alt={memberName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                              </div>
                              <p style={{ margin: 0, color: '#312527', fontSize: '0.78rem', fontWeight: '600' }}>{memberName}</p>
                            </div>
                          );
                        })}
                      </div>
                      {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                          {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setMemberPage(i)}
                              style={{
                                width: memberPage === i ? '20px' : '8px',
                                height: '8px',
                                borderRadius: '999px',
                                border: 'none',
                                backgroundColor: memberPage === i ? '#8D6E73' : '#C2B0B4',
                                cursor: 'pointer',
                                padding: 0,
                                transition: 'all 0.2s ease',
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}