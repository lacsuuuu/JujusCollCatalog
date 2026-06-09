import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfile } from '../../hooks/useProfile';
import ProfileHeader from './ProfileHeader';
import ProfileFilters from './ProfileFilters';
import ProfileMerchGrid from './ProfileMerchGrid';
import ProfileBinders from './ProfileBinders';
import ItemDetailModal from '../ui/ItemDetailModal';
import ThemeAlert from '../ui/ThemeAlert';
import { useUserProfile } from '../../hooks/useUserProfile';
import UserSearch from '../ui/UserSearch';
import { auth, db } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function Profile({ user }) {
  const { username } = useParams(); 
  const navigate = useNavigate();

  const [targetUserId, setTargetUserId] = useState(null);

  useEffect(() => {
    const resolveUsername = async () => {
      if (!username) return;
      try {
        const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
        if (snap.exists()) {
          setTargetUserId(snap.data().uid);
        } else {
          setTargetUserId('not-found');
        }
      } catch (error) {
        console.error("Error resolving username:", error);
        setTargetUserId('not-found');
      }
    };
    resolveUsername();
  }, [username]);

  const isOwnProfile = user?.uid === targetUserId;
  const { profileData: viewerProfile } = useUserProfile(user?.uid || 'guest');

  const {
    merch, globalMerch, groups, loading, profileData, alertMsg, setAlertMsg,
    saveProfile
  } = useProfile(targetUserId === 'not-found' ? null : targetUserId);

  const [selectedItem, setSelectedItem] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(profileData);

  useEffect(() => { setEditForm(profileData); }, [profileData]);

  const [filterCategory, setFilterCategory] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterEra, setFilterEra] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [groupBy, setGroupBy] = useState('Member');

  const uniqueGroupNames = ['All', ...Array.from(new Set(groups.map(g => g.name).filter(Boolean))).sort()];
  const currentGroup = groups.find(g => g.name === filterGroup);
  const dbEras = currentGroup?.eras || [];
  const dbMembers = currentGroup?.members || [];
  const activeMerch = merch.filter(i => i.groupName === filterGroup);

  const uniqueEras = ['All', ...[...new Set([...dbEras, ...activeMerch.map(i => i.era)].filter(Boolean))].sort()];
  const uniqueMembers = ['All', ...[...new Set([...dbMembers, ...activeMerch.map(i => i.memberName)].filter(Boolean))].sort()];
  const uniqueCategories = ['All', 'Photocard', 'Album', 'Lightstick', 'Postcard / Poster', 'Plushie / Toy', 'Other'];

  const handleGroupChange = (val) => {
    setFilterGroup(val);
    setFilterEra('All');
    setFilterMember('All');
    setFilterCategory('All');
  };

  const resetFilters = () => {
    setFilterCategory('All');
    if (uniqueGroupNames.length > 0) setFilterGroup(uniqueGroupNames[0]);
    setFilterEra('All');
    setFilterMember('All');
    setSearchQuery('');
    setDateStart('');
    setDateEnd('');
  };

  const filteredMerch = merch.filter(item => {
    const matchCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchGroup = filterGroup === 'All' || item.groupName === filterGroup;
    const matchEra = filterEra === 'All' || item.era === filterEra;
    const matchMember = filterMember === 'All' || item.memberName === filterMember;
    const searchLower = searchQuery.toLowerCase();
    const matchSearch =
      (item.customName || '').toLowerCase().includes(searchLower) ||
      (item.groupName || '').toLowerCase().includes(searchLower) ||
      (item.memberName || '').toLowerCase().includes(searchLower);

    let matchDate = true;
    if (dateStart || dateEnd) {
      if (!item.releaseDate) {
        matchDate = false;
      } else {
        const itemDate = item.releaseDate?.toDate ? item.releaseDate.toDate() : new Date(item.releaseDate);
        if (dateStart && itemDate < new Date(dateStart + '-01T00:00:00Z')) matchDate = false;
        if (dateEnd) {
          const [y, m] = dateEnd.split('-');
          if (itemDate > new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))) matchDate = false;
        }
      }
    }
    return matchCategory && matchGroup && matchEra && matchMember && matchSearch && matchDate;
  });

  const ownedCollection = filteredMerch.filter(i => i.status === 'owned' || i.status === 'on the way');
  const wishlistCollection = filteredMerch.filter(i => i.status === 'wishlisted');
 
  const handlePasswordReset = async () => {
    if (!user?.email) return setAlertMsg("No email found for this user.");
    
    try {
      await sendPasswordResetEmail(auth, user.email);
      setAlertMsg('Password reset link sent! Check your inbox.');
    } catch (error) {
      setAlertMsg('Error: ' + error.message);
    }
  };

  const handleSaveProfile = async () => {
    const oldUsername = profileData.username;
    const ok = await saveProfile(editForm);
    if (ok) {
      setIsEditing(false);
      if (editForm.username && editForm.username !== oldUsername) {
        navigate(`/profile/${editForm.username}`);
      }
    }
  };

  if (targetUserId === 'not-found') return <div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>User not found.</div>;
  if (!targetUserId || loading) return <p style={{ textAlign: 'center', color: '#6A585B' }}>Loading profile...</p>;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem', textAlign: 'left' }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <UserSearch />
      </div>

      <ProfileHeader
        user={user}
        profileData={profileData}
        editForm={editForm}
        setEditForm={setEditForm}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        isOwnProfile={isOwnProfile}
      />

      {/* Profile info / edit form */}
      <div className="profile-info" style={{ padding: '0 1rem', marginBottom: '3rem', position: 'relative' }}>
        {isEditing && isOwnProfile ? (
          <div className="edit-profile-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px' }}>
            <p style={{ color: '#6A585B', margin: 0, fontSize: '0.9rem' }}><em>Click your avatar or banner above to upload an image.</em></p>
            
            <input 
              type="text" 
              className="theme-input"
              placeholder="Display Name" 
              value={editForm.displayName || ''} 
              onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} 
              style={{ padding: '0.5rem 0.75rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} 
            />
            
            <input 
              type="text" 
              className="theme-input"
              placeholder="@username" 
              value={editForm.username || ''} 
              onChange={e => setEditForm({ ...editForm, username: e.target.value })} 
              style={{ padding: '0.5rem 0.75rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} 
            />
            
            <textarea 
              className="theme-input"
              placeholder="Bio" 
              value={editForm.bio || ''} 
              onChange={e => setEditForm({ ...editForm, bio: e.target.value })} 
              rows="3"
              style={{ padding: '0.5rem 0.75rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} 
            />

            <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <button 
                type="button"
                onClick={handlePasswordReset} 
                style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', width: '100%', transition: 'background-color 0.2s', fontWeight: '500' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(141, 110, 115, 0.1)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Send Password Reset Email
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button onClick={handleSaveProfile} onMouseEnter={() => setHoveredButton('save')} onMouseLeave={() => setHoveredButton(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: hoveredButton === 'save' ? '#6B5458' : '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'background-color 0.2s', flex: 1 }}>Save</button>
              <button onClick={() => { setIsEditing(false); setEditForm(profileData); }} onMouseEnter={() => setHoveredButton('cancel')} onMouseLeave={() => setHoveredButton(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: hoveredButton === 'cancel' ? '#D4C4C7' : 'transparent', color: '#6A585B', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', transition: 'background-color 0.2s', flex: 1 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="profile-title" style={{ margin: '0 0 0.2rem 0', color: '#312527', fontSize: '1.5rem', fontWeight: '700' }}>
              {profileData?.displayName || 'Unknown User'}
            </h1>
            <p style={{ margin: '0 0 0.5rem 0', color: '#8D6E73', fontSize: '0.95rem', fontWeight: '500' }}>
              @{profileData?.username || 'username'}
            </p>
            <p style={{ margin: '0', color: '#6A585B', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              {profileData?.bio || 'No bio provided.'}
            </p>
          </>
        )}
      </div>

      {/* Public binders section */}
      <ProfileBinders userId={targetUserId} globalMerch={globalMerch} />

      <ProfileFilters
        filterGroup={filterGroup}
        filterCategory={filterCategory}
        filterEra={filterEra}
        filterMember={filterMember}
        searchQuery={searchQuery}
        dateStart={dateStart}
        dateEnd={dateEnd}
        showAdvanced={showAdvanced}
        uniqueGroupNames={uniqueGroupNames}
        uniqueCategories={uniqueCategories}
        uniqueEras={uniqueEras}
        uniqueMembers={uniqueMembers}
        onGroupChange={handleGroupChange}
        setFilterCategory={setFilterCategory}
        setFilterEra={setFilterEra}
        setFilterMember={setFilterMember}
        setSearchQuery={setSearchQuery}
        setDateStart={setDateStart}
        setDateEnd={setDateEnd}
        setShowAdvanced={setShowAdvanced}
        resetFilters={resetFilters}
      />

      <ProfileMerchGrid
        items={ownedCollection}
        emptyMsg="No matching items in collection."
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        currentGroup={currentGroup}
        filterGroup={filterGroup}
        showGroupByControl
        onSelectItem={setSelectedItem}
      />

      <div style={{ marginTop: '4rem' }}>
        <ProfileMerchGrid
          items={wishlistCollection}
          emptyMsg="No matching items in wishlist."
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          currentGroup={currentGroup}
          filterGroup={filterGroup}
          onSelectItem={setSelectedItem}
        />
      </div>

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} user={user} userRole={viewerProfile?.role} />
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
}