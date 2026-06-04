import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import ThemeAlert from '../ui/ThemeAlert';

const inputStyle = {
  padding: '0.7rem 1rem',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#E6DADD',
  color: '#312527',
  fontSize: '0.95rem',
  outline: 'none',
  flex: 1,
  boxSizing: 'border-box',
};

const sectionStyle = {
  backgroundColor: '#D4C4C7',
  borderRadius: '10px',
  padding: '1.5rem',
  boxShadow: '0 1px 4px rgba(49, 37, 39, 0.1)',
  marginBottom: '1.5rem',
  transition: 'transform 0.2s, box-shadow 0.2s',
};

export default function GroupManager() {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newMember, setNewMember] = useState({});
  const [newEra, setNewEra] = useState({});
  const [expanded, setExpanded] = useState({});
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const [draggedSub, setDraggedSub] = useState(null);
  const [dragOverSub, setDragOverSub] = useState(null);

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const fetchedGroups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedGroups.sort((a, b) => (a.order || 0) - (b.order || 0));
      setGroups(fetchedGroups);
    });
    return () => unsub();
  }, []);

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      await addDoc(collection(db, 'groups'), { name, members: [], eras: [], order: groups.length });
      setNewGroupName('');
    } catch {
      setAlertMsg("Error adding group.");
    }
  };

  const handleDeleteGroup = (groupId) => {
    setConfirmAction({
      message: 'Delete this group and all its data?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'groups', groupId));
        } catch {
          setAlertMsg("Error deleting group.");
        }
      }
    });
  };

  const handleSaveGroupName = async (id) => {
    if (editGroupName.trim()) {
      try {
        await updateDoc(doc(db, 'groups', id), { name: editGroupName.trim() });
      } catch {
        setAlertMsg("Error renaming group.");
      }
    }
    setEditingGroupId(null);
  };

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIdx(index);
  };

  const handleDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) {
      setDragOverIdx(null);
      setDraggedIdx(null);
      return;
    }
    const reorderedGroups = [...groups];
    const [draggedItem] = reorderedGroups.splice(draggedIdx, 1);
    reorderedGroups.splice(dropIdx, 0, draggedItem);
    setDraggedIdx(null);
    setDragOverIdx(null);

    try {
      await Promise.all(
        reorderedGroups.map((g, idx) => updateDoc(doc(db, 'groups', g.id), { order: idx }))
      );
    } catch {
      setAlertMsg("Error saving new group order.");
    }
  };

  const handleSubDragStart = (e, id, type, idx) => {
    e.stopPropagation();
    setDraggedSub({ id, type, idx });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubDragOver = (e, id, type, idx) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedSub && draggedSub.id === id && draggedSub.type === type) {
      setDragOverSub({ id, type, idx });
    }
  };

  const handleSubDrop = async (e, group, type, dropIdx) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedSub || draggedSub.id !== group.id || draggedSub.type !== type) {
      setDragOverSub(null);
      setDraggedSub(null);
      return;
    }

    const dragIdx = draggedSub.idx;
    if (dragIdx === dropIdx) {
      setDragOverSub(null);
      setDraggedSub(null);
      return;
    }

    const currentList = [...(group[type] || [])];
    const [draggedItem] = currentList.splice(dragIdx, 1);
    currentList.splice(dropIdx, 0, draggedItem);

    setDraggedSub(null);
    setDragOverSub(null);

    try {
      await updateDoc(doc(db, 'groups', group.id), { [type]: currentList });
    } catch {
      setAlertMsg(`Error saving new ${type} order.`);
    }
  };

  const handleSubDragEnd = (e) => {
    e.stopPropagation();
    setDraggedSub(null);
    setDragOverSub(null);
  };

  const handleAddMember = async (group) => {
    const name = (newMember[group.id] || '').trim();
    if (!name) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), { members: [...(group.members || []), name] });
      setNewMember(prev => ({ ...prev, [group.id]: '' }));
    } catch {
      setAlertMsg("Error adding member.");
    }
  };

  const handleRemoveMember = async (group, member) => {
    try {
      await updateDoc(doc(db, 'groups', group.id), { members: group.members.filter(m => m !== member) });
    } catch {
      setAlertMsg("Error removing member.");
    }
  };

  const handleAddEra = async (group) => {
    const name = (newEra[group.id] || '').trim();
    if (!name) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), { eras: [...(group.eras || []), name] });
      setNewEra(prev => ({ ...prev, [group.id]: '' }));
    } catch {
      setAlertMsg("Error adding era.");
    }
  };

  const handleRemoveEra = async (group, era) => {
    try {
      await updateDoc(doc(db, 'groups', group.id), { eras: group.eras.filter(e => e !== era) });
    } catch {
      setAlertMsg("Error removing era.");
    }
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>

      <style>{`
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #8D6E73 !important; }
        .draggable-card { cursor: grab; }
        .draggable-card:active { cursor: grabbing; }
        .draggable-card:hover { box-shadow: 0 4px 12px rgba(49, 37, 39, 0.15) !important; }
        .draggable-pill { cursor: grab; }
        .draggable-pill:active { cursor: grabbing; }
        .draggable-pill:hover { background-color: #D4C4C7 !important; }
      `}</style>

      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

      {confirmAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49, 37, 39, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#E6DADD', padding: '1.5rem 2rem', borderRadius: '12px', border: '1px solid #D4C4C7', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '320px', width: '90%' }}>
            <p style={{ color: '#312527', margin: '0 0 1.5rem 0', fontWeight: '600' }}>{confirmAction.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8D6E73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Delete</button>
              <button onClick={() => setConfirmAction(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527', margin: '0 0 1.5rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #8D6E73' }}>
        Manage Groups
      </h2>

      <div style={{ marginBottom: '1.5rem', padding: '1.2rem', backgroundColor: '#D4C4C7', borderRadius: '10px' }}>
        <input
          type="text"
          className="theme-input"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={sectionStyle}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6A585B' }}>Add New Group</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input className="theme-input" style={inputStyle} type="text" placeholder="Group name (e.g. NewJeans)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddGroup()} />
          <button onClick={handleAddGroup} style={{ padding: '0.7rem 1.5rem', backgroundColor: '#8D6E73', color: '#E6DADD', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Add Group</button>
        </div>
      </div>

      {filteredGroups.length === 0 && <p style={{ color: '#6A585B', fontSize: '0.9rem' }}>No groups found.</p>}

      {filteredGroups.map((group, index) => {
        const canDrag = searchQuery.length === 0;

        return (
          <div
            key={group.id}
            className={canDrag ? "draggable-card" : ""}
            draggable={canDrag}
            onDragStart={(e) => canDrag && handleDragStart(e, index)}
            onDragOver={(e) => canDrag && handleDragOver(e, index)}
            onDrop={(e) => canDrag && handleDrop(e, index)}
            onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
            style={{
              ...sectionStyle,
              opacity: draggedIdx === index ? 0.4 : 1,
              borderTop: dragOverIdx === index && draggedIdx !== index ? '3px solid #8D6E73' : '3px solid transparent',
              marginTop: dragOverIdx === index ? '-3px' : '0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded[group.id] ? '1.25rem' : 0 }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <div onClick={() => toggleExpand(group.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1 }}>
                  {editingGroupId === group.id ? (
                    <input
                      className="theme-input"
                      autoFocus
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      onBlur={() => handleSaveGroupName(group.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGroupName(group.id); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: '#E6DADD', border: 'none', borderRadius: '4px', color: '#312527', fontSize: '1.1rem', fontWeight: '700', padding: '0.2rem 0.5rem', outline: 'none', width: '200px' }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); setEditGroupName(group.name); }}
                      title="Double click to edit name"
                      style={{ fontSize: '1.2rem', fontWeight: '700', color: '#312527', userSelect: 'none' }}
                    >
                      {group.name}
                    </span>
                  )}
                  <span style={{ color: '#6A585B', fontSize: '0.85rem' }}>{group.members?.length || 0} members · {group.eras?.length || 0} eras</span>
                  <span style={{ color: '#6A585B', fontSize: '0.75rem', marginLeft: '0.25rem' }}>{expanded[group.id] ? '▲' : '▼'}</span>
                </div>
              </div>

              <button onClick={() => handleDeleteGroup(group.id)} style={{ background: 'transparent', border: '1px solid #8D6E73', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', color: '#8D6E73', fontSize: '0.8rem' }}>Delete</button>
            </div>

            {expanded[group.id] && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                {/* MEMBERS */}
                <div>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6A585B' }}>Members</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input className="theme-input" style={{ ...inputStyle, fontSize: '0.85rem', padding: '0.5rem 0.75rem' }} type="text" placeholder="Member name" value={newMember[group.id] || ''} onChange={e => setNewMember(prev => ({ ...prev, [group.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleAddMember(group)} />
                    <button onClick={() => handleAddMember(group)} style={{ padding: '0.5rem 1rem', backgroundColor: '#8D6E73', color: '#E6DADD', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Add</button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {(group.members || []).map((member, idx) => {
                      const isDragging = draggedSub?.id === group.id && draggedSub?.type === 'members' && draggedSub?.idx === idx;
                      const isOver = dragOverSub?.id === group.id && dragOverSub?.type === 'members' && dragOverSub?.idx === idx;
                      return (
                        <span
                          key={member}
                          className="draggable-pill"
                          draggable
                          onDragStart={(e) => handleSubDragStart(e, group.id, 'members', idx)}
                          onDragOver={(e) => handleSubDragOver(e, group.id, 'members', idx)}
                          onDrop={(e) => handleSubDrop(e, group, 'members', idx)}
                          onDragEnd={handleSubDragEnd}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: isOver ? '#C2B0B4' : '#E6DADD', border: '1px solid transparent', borderRadius: '20px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#312527', userSelect: 'none', opacity: isDragging ? 0.4 : 1, transition: 'background-color 0.2s' }}
                        >
                          <span>{member}</span>
                          <button onClick={() => handleRemoveMember(group, member)} style={{ background: 'none', border: 'none', color: '#6A585B', cursor: 'pointer', fontSize: '0.75rem', padding: 0, lineHeight: 1, marginLeft: '0.25rem' }}>✕</button>
                        </span>
                      );
                    })}
                    {(group.members || []).length === 0 && <span style={{ color: '#6A585B', fontSize: '0.8rem' }}>No members yet</span>}
                  </div>
                </div>

                {/* ERAS */}
                <div>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6A585B' }}>Eras</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input className="theme-input" style={{ ...inputStyle, fontSize: '0.85rem', padding: '0.5rem 0.75rem' }} type="text" placeholder="Era name" value={newEra[group.id] || ''} onChange={e => setNewEra(prev => ({ ...prev, [group.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleAddEra(group)} />
                    <button onClick={() => handleAddEra(group)} style={{ padding: '0.5rem 1rem', backgroundColor: '#8D6E73', color: '#E6DADD', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Add</button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {(group.eras || []).map((era, idx) => {
                      const isDragging = draggedSub?.id === group.id && draggedSub?.type === 'eras' && draggedSub?.idx === idx;
                      const isOver = dragOverSub?.id === group.id && dragOverSub?.type === 'eras' && dragOverSub?.idx === idx;
                      return (
                        <span
                          key={era}
                          className="draggable-pill"
                          draggable
                          onDragStart={(e) => handleSubDragStart(e, group.id, 'eras', idx)}
                          onDragOver={(e) => handleSubDragOver(e, group.id, 'eras', idx)}
                          onDrop={(e) => handleSubDrop(e, group, 'eras', idx)}
                          onDragEnd={handleSubDragEnd}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: isOver ? '#C2B0B4' : '#E6DADD', border: '1px solid transparent', borderRadius: '20px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#312527', userSelect: 'none', opacity: isDragging ? 0.4 : 1, transition: 'background-color 0.2s' }}
                        >
                          <span>{era}</span>
                          <button onClick={() => handleRemoveEra(group, era)} style={{ background: 'none', border: 'none', color: '#6A585B', cursor: 'pointer', fontSize: '0.75rem', padding: 0, lineHeight: 1, marginLeft: '0.25rem' }}>✕</button>
                        </span>
                      );
                    })}
                    {(group.eras || []).length === 0 && <span style={{ color: '#6A585B', fontSize: '0.8rem' }}>No eras yet</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}