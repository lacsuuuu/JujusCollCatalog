import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import imageCompression from 'browser-image-compression';
import ThemeAlert from '../ui/ThemeAlert';

const CustomSelect = ({ value, onChange, options, placeholder, disabled, required, style, showArrow = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = value ? options.find(o => o.value === value)?.label || value : placeholder;

  return (
    <div 
      ref={containerRef} 
      className={disabled ? "" : "theme-select-wrapper"}
      style={{ position: 'relative', outline: 'none', width: '100%', boxSizing: 'border-box', ...style }} 
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
           e.preventDefault();
           if (!disabled) setIsOpen(!isOpen);
        }
      }}
    >
      <div
        className="theme-select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: showArrow ? '0.7rem 2.5rem 0.7rem 1rem' : '0.7rem 1rem',
          borderRadius: '6px',
          backgroundColor: disabled ? '#A08D90' : '#C2B0B4',
          color: '#312527',
          fontSize: '0.95rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...(showArrow ? {
            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23312527' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.75rem center',
            backgroundSize: '1em',
          } : {}),
          opacity: disabled ? 0.5 : 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxSizing: 'border-box',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          transition: 'box-shadow 0.2s'
        }}
      >
        {displayLabel}
      </div>

      {isOpen && !disabled && (
        <div className="custom-scroll" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#F9F6F0',
          border: '1px solid #C2B0B4', borderRadius: '6px', marginTop: '4px',
          maxHeight: '180px', overflowY: 'auto', overflowX: 'hidden', zIndex: 30,
          boxShadow: '0 4px 16px rgba(49,37,39,0.15)', padding: '0.25rem 0'
        }}>
          {options.map((opt, i) => (
            <div key={i} className="theme-dropdown-item" onClick={(e) => { e.stopPropagation(); onChange(opt.value); setIsOpen(false); }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
      {required && <input type="text" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0, bottom: 0, left: 0 }} value={value || ''} onChange={()=>{}} required />}
    </div>
  );
};

const AutocompleteInput = ({ value, onChange, options, placeholder, disabled, required, style }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes((value || '').toLowerCase()));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', boxSizing: 'border-box', ...style }}>
      <input
        className="theme-input"
        style={{
          padding: '0.7rem 1rem', borderRadius: '6px', border: 'none',
          backgroundColor: disabled ? '#A08D90' : '#C2B0B4',
          color: '#312527', fontSize: '0.95rem', outline: 'none',
          width: '100%', boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 0.5 : 1,
        }}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        disabled={disabled}
        required={required}
      />
      {isOpen && !disabled && filteredOptions.length > 0 && (
        <div className="custom-scroll" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#F9F6F0',
          border: '1px solid #C2B0B4', borderRadius: '6px', marginTop: '4px',
          maxHeight: '180px', overflowY: 'auto', overflowX: 'hidden', zIndex: 30,
          boxShadow: '0 4px 16px rgba(49,37,39,0.15)', padding: '0.25rem 0'
        }}>
          {filteredOptions.map((opt, i) => (
            <div key={i} className="theme-dropdown-item" onMouseDown={(e) => { e.preventDefault(); onChange(opt); setIsOpen(false); }}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const categoryOptions = [
  { value: 'Photocard', label: 'Photocard' },
  { value: 'Album', label: 'Album' },
  { value: 'Lightstick', label: 'Lightstick' },
  { value: 'Postcard / Poster', label: 'Postcard / Poster' },
  { value: 'Plushie / Toy', label: 'Plushie / Toy' },
  { value: 'Other', label: 'Other' }
];

const pcTypeOptions = [
  { value: 'Album', label: 'Album' },
  { value: 'POB', label: 'POB' },
  { value: 'Merch', label: 'Merch' },
  { value: 'Brand', label: 'Brand' },
  { value: 'Magazine', label: 'Magazine' },
  { value: 'Polaroid', label: 'Polaroid' },
];

const pcFinishOptions = [
  { value: 'Glossy', label: 'Glossy' },
  { value: 'Matte', label: 'Matte' },
  { value: 'Holographic', label: 'Holographic' },
  { value: 'Lenticular', label: 'Lenticular' },
  { value: 'Glitter', label: 'Glitter' },
];

export default function AddMerch() {
  const [merch, setMerch] = useState([]);
  const [groups, setGroups] = useState([]);
  
  // Independent Auth State
  const [user, setUser] = useState(undefined); 
  
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedEra, setSelectedEra] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]); 
  const [groupItem, setGroupItem] = useState(false); 
  
  const [category, setCategory] = useState('');
  const [photocardType, setPhotocardType] = useState('Album');
  const [photocardFinish, setPhotocardFinish] = useState('Glossy');
  
  const [customName, setCustomName] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  
  const [alertMsg, setAlertMsg] = useState(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [backFile, setBackFile] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [backDragging, setBackDragging] = useState(false);
  const backFileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen to Firebase directly to secure the component state
    const auth = getAuth();
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubMerch = onSnapshot(collection(db, 'merchandise'), (snapshot) => {
      setMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    return () => { 
      unsubGroups(); 
      unsubMerch(); 
      unsubAuth();
    };
  }, []);

  // Show nothing while the component is checking auth state or if not logged in
  if (!user) return null;

  const currentGroup = groups.find(g => g.name === selectedGroup);
  const uniqueItemNames = [...new Set(merch.map(i => i.customName).filter(Boolean))].sort();

  const handleGroupChange = (val) => {
    setSelectedGroup(val);
    if (!val) {
      setSelectedEra('');
      setSelectedMember('');
      setSelectedMembers([]);
      setGroupItem(false);
    }
  };

  const handleGroupItemToggle = () => {
    setGroupItem(prev => !prev);
    setSelectedMember('');
    setSelectedMembers([]);
  };

  const handleMemberToggle = (m) => {
    if (selectedMembers.includes(m)) {
      setSelectedMembers(selectedMembers.filter(sm => sm !== m));
    } else {
      setSelectedMembers([...selectedMembers, m]);
    }
  };

  const handleFile = (f) => { if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); };
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleFile(f); };

  const handleBackFile = (f) => { if (!f) return; setBackFile(f); setBackPreview(URL.createObjectURL(f)); };
  const handleBackDrop = (e) => { e.preventDefault(); setBackDragging(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleBackFile(f); };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setAlertMsg("Please select a main image!");
    if (!selectedGroup) return setAlertMsg("Please select or type a group!");
    if (!category) return setAlertMsg("Please select a merchandise type!");
    setLoading(true);

    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

      const compressedFile = await imageCompression(file, options);
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', uploadPreset);
      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
      const cloudData = await cloudRes.json();
      if (!cloudRes.ok) throw new Error(cloudData.error.message || "Front image upload failed");

      let backImageUrl = null;
      if (category === 'Photocard' && backFile) {
        const compressedBackFile = await imageCompression(backFile, options);
        const backFormData = new FormData();
        backFormData.append('file', compressedBackFile);
        backFormData.append('upload_preset', uploadPreset);
        const backCloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: backFormData });
        const backCloudData = await backCloudRes.json();
        if (!backCloudRes.ok) throw new Error(backCloudData.error.message || "Back image upload failed");
        backImageUrl = backCloudData.secure_url;
      }

      let finalMemberName = '';
      if (groupItem) {
        finalMemberName = selectedMembers.length > 0 ? selectedMembers.join(', ') : 'Group';
      } else {
        finalMemberName = selectedMember;
      }

      const payload = {
        customName,
        category,
        groupName: selectedGroup, 
        memberName: finalMemberName,
        era: selectedEra,
        imageUrl: cloudData.secure_url,
        status: "unowned",
        addedAt: new Date()
      };
      
      if (category === 'Photocard') {
        payload.photocardType = photocardType;
        payload.photocardFinish = photocardFinish;
      }
      
      if (releaseDate) {
        payload.releaseDate = new Date(releaseDate + '-01T12:00:00Z');
      }
      
      if (backImageUrl) payload.backImageUrl = backImageUrl;

      await addDoc(collection(db, "merchandise"), payload);

      setAlertMsg("Merchandise added!");
      setFile(null); setPreview(null); setBackFile(null); setBackPreview(null);
      setCustomName(''); setCategory(''); setReleaseDate('');
      setPhotocardType('Album'); setPhotocardFinish('Matte');
      setSelectedGroup(''); setSelectedEra(''); setSelectedMember(''); setSelectedMembers([]); setGroupItem(false);

    } catch (error) {
      console.error("Upload failed:", error);
      setAlertMsg(`Something went wrong: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const displayReleaseDate = releaseDate ? `${releaseDate.split('-')[1]}/${releaseDate.split('-')[0]}` : 'MM/YYYY';

  return (
    <div style={{ maxWidth: '480px', width: '100%', margin: '2rem auto', padding: '1.5rem', backgroundColor: '#D4C4C7', borderRadius: '12px', boxShadow: '0 2px 8px rgba(49,37,39,0.08)' }}>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
      <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527' }}>Add New Merchandise</h2>

      <style>{`
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus, .theme-select-wrapper:focus .theme-select-trigger, .theme-date-picker:focus-within { 
          box-shadow: 0 0 0 2px #E6DADD, 0 0 0 4px #8D6E73 !important; outline: none; border-radius: 6px;
        }

        .theme-dropdown-item { padding: 0.5rem 0.75rem; cursor: pointer; color: #312527; font-size: 0.85rem; background-color: transparent; text-align: center; }
        .theme-dropdown-item:hover { background-color: #8D6E73; color: #FFFFFF; }
        
        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }

        /* The CSS Magic to make the invisible input fully clickable across the entire box */
        input[type="month"]::-webkit-calendar-picker-indicator {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          opacity: 0;
          cursor: pointer;
        }
      `}</style>

      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        
        <CustomSelect
          options={groups.map(g => ({ value: g.name, label: g.name }))}
          value={selectedGroup}
          onChange={handleGroupChange}
          placeholder="Select a group..."
          required
          showArrow
        />

        <CustomSelect
          options={(currentGroup?.eras || []).map(e => ({ value: e, label: e }))}
          value={selectedEra}
          onChange={setSelectedEra}
          placeholder={selectedGroup ? 'Select an era...' : 'Select a group first'}
          disabled={!selectedGroup}
          required
          showArrow
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0' }}>
          <span style={{ fontSize: '0.85rem', color: '#312527', fontWeight: '600' }}>Tag multiple members? (Group-wide mode)</span>
          <div
            onClick={selectedGroup ? handleGroupItemToggle : undefined}
            style={{ width: '40px', height: '22px', borderRadius: '20px', backgroundColor: groupItem ? '#8D6E73' : '#A08D90', position: 'relative', cursor: selectedGroup ? 'pointer' : 'not-allowed', opacity: selectedGroup ? 1 : 0.4, transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '3px', left: groupItem ? '21px' : '3px', transition: 'left 0.2s' }} />
          </div>
        </div>

        {!groupItem ? (
          <CustomSelect
            options={(currentGroup?.members || []).map(m => ({ value: m, label: m }))}
            value={selectedMember}
            onChange={setSelectedMember}
            placeholder={selectedGroup ? 'Select a member...' : 'Select a group first'}
            disabled={!selectedGroup}
            required={!groupItem}
            showArrow
          />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#C2B0B4', borderRadius: '6px' }}>
            <div style={{ width: '100%', fontSize: '0.75rem', color: '#6A585B', fontWeight: '600', marginBottom: '0.2rem' }}>
              Select specific members to tag (leave blank for general group merch):
            </div>
            {(currentGroup?.members || []).map(m => (
              <div 
                key={m}
                onClick={() => handleMemberToggle(m)}
                style={{ 
                  fontSize: '0.8rem', cursor: 'pointer', padding: '0.4rem 0.8rem', borderRadius: '20px', transition: 'all 0.2s',
                  backgroundColor: selectedMembers.includes(m) ? '#8D6E73' : 'transparent', 
                  color: selectedMembers.includes(m) ? '#FFFFFF' : '#312527', 
                  border: selectedMembers.includes(m) ? '1px solid #8D6E73' : '1px solid #A08D90' 
                }}
              >
                {m}
              </div>
            ))}
          </div>
        )}

        <CustomSelect 
          options={categoryOptions}
          value={category}
          onChange={val => { setCategory(val); if (val !== 'Photocard') { setBackFile(null); setBackPreview(null); } }}
          placeholder="Select Merch Type..."
          required
          showArrow
        />

        {category === 'Photocard' && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <CustomSelect 
              options={pcTypeOptions}
              value={photocardType}
              onChange={setPhotocardType}
              style={{ flex: '2 1 150px' }}
              showArrow
            />
            <CustomSelect 
              options={pcFinishOptions}
              value={photocardFinish}
              onChange={setPhotocardFinish}
              style={{ flex: '1 1 100px' }}
              showArrow
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <AutocompleteInput
            options={uniqueItemNames}
            value={customName}
            onChange={setCustomName}
            placeholder="Item Name (e.g. Apple Music 3.0)"
            style={{ flex: '2 1 250px' }}
            required
          />

          <div className="theme-date-picker" style={{ position: 'relative', display: 'flex', alignItems: 'center', backgroundColor: '#C2B0B4', borderRadius: '6px', padding: '0.7rem 1rem', flex: '1 1 200px', transition: 'box-shadow 0.2s', boxSizing: 'border-box', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.95rem', color: '#6A585B', pointerEvents: 'none', zIndex: 1 }}>Release Date:</span>
            <span style={{ flex: 1, textAlign: 'center', color: '#312527', fontSize: '0.95rem', fontWeight: '500', pointerEvents: 'none', zIndex: 1 }}>{displayReleaseDate}</span>
            <svg style={{ pointerEvents: 'none', zIndex: 1 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <input type="month" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileInputRef.current.click()}
            style={{ flex: 1, border: `2px dashed ${dragging ? '#8D6E73' : '#A08D90'}`, borderRadius: '8px', padding: '1.5rem 0.5rem', textAlign: 'center', cursor: 'pointer', backgroundColor: dragging ? '#B09C9F' : '#C2B0B4', transition: 'all 0.2s' }}>
            {preview ? (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="del-btn"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: 'rgba(49,37,39,0.65)', backdropFilter: 'blur(4px)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', zIndex: 5, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', padding: 0 }}
                  title="Remove Image"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <img src={preview} alt="Preview" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} />
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#6A585B' }}>{category === 'Photocard' ? 'Change Front' : 'Change Image'}</p>
              </div>
            ) : (
              <><p style={{ margin: 0 }}><img src="/frame.svg" alt="Frame" width="25" height="25" /></p><p style={{ margin: '0.5rem 0 0.25rem', color: '#312527', fontSize: '0.85rem', fontWeight: '600' }}>{category === 'Photocard' ? 'Front Image' : 'Drop image here'}</p><p style={{ margin: 0, color: '#6A585B', fontSize: '0.75rem' }}>Drop or click to browse</p></>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
          </div>

          {category === 'Photocard' && (
            <div onDragOver={(e) => { e.preventDefault(); setBackDragging(true); }} onDragLeave={() => setBackDragging(false)} onDrop={handleBackDrop} onClick={() => backFileInputRef.current.click()}
              style={{ flex: 1, border: `2px dashed ${backDragging ? '#8D6E73' : '#A08D90'}`, borderRadius: '8px', padding: '1.5rem 0.5rem', textAlign: 'center', cursor: 'pointer', backgroundColor: backDragging ? '#B09C9F' : '#C2B0B4', transition: 'all 0.2s' }}>
              {backPreview ? (
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="del-btn"
                    onClick={(e) => { e.stopPropagation(); setBackFile(null); setBackPreview(null); if (backFileInputRef.current) backFileInputRef.current.value = ''; }}
                    style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: 'rgba(49,37,39,0.65)', backdropFilter: 'blur(4px)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', zIndex: 5, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', padding: 0 }}
                    title="Remove Image"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                  <img src={backPreview} alt="Back Preview" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} />
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#6A585B' }}>Change Back</p>
                </div>
              ) : (
                <><p style={{ margin: 0, opacity: 0.5 }}><img src="/frame.svg" alt="Frame" width="25" height="25" /></p><p style={{ margin: '0.5rem 0 0.25rem', color: '#312527', fontSize: '0.85rem', fontWeight: '600' }}>Backprint</p><p style={{ margin: 0, color: '#6A585B', fontSize: '0.75rem' }}>Drop or click to browse</p></>
              )}
              <input ref={backFileInputRef} type="file" accept="image/*" onChange={e => handleBackFile(e.target.files[0])} style={{ display: 'none' }} />
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: loading ? '#C2B0B4' : '#8D6E73', color: loading ? '#6A585B' : '#FFFFFF', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s' }}>
          {loading ? "Processing..." : "Add to Database"}
        </button>
      </form>
    </div>
  );
}