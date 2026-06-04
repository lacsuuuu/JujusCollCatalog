import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, doc, getDoc, setDoc, documentId, getDocs, writeBatch } from 'firebase/firestore';

const DEFAULT_AVATAR = '/bunny.png';
const DEFAULT_BANNER = '';

const DEFAULT_PROFILE = {
  displayName: "Juju's Coll Catalog",
  username: "juju",
  bio: "No Bio",
  avatarUrl: DEFAULT_AVATAR,
  bannerUrl: DEFAULT_BANNER,
};

export function useProfile(userId) {
  const [merch, setMerch] = useState([]);
  const [globalMerch, setGlobalMerch] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(DEFAULT_PROFILE);
  const [alertMsg, setAlertMsg] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    // 1. Fetch Profile Data
    const fetchProfile = async () => {
      const profileSnap = await getDoc(doc(db, 'profile', userId));
      if (profileSnap.exists()) {
        setProfileData(profileSnap.data());
      } else {
        setProfileData(DEFAULT_PROFILE); 
      }
    };
    fetchProfile();

    // 2. Fetch Groups
    const unsubGroups = onSnapshot(query(collection(db, 'groups')), (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. TARGETED FETCH: Get user's collected links first, then fetch ONLY those merch items
    // FIXED: Point to the correct subcollection path
    const collectedRef = collection(db, 'profile', userId, 'collected_items');
    
    const unsubCollected = onSnapshot(collectedRef, async (snapshot) => {
      // FIXED: Inject the document ID as merchId
      const links = snapshot.docs.map(d => ({
        ...d.data(),
        merchId: d.id
      }));
      
      if (links.length === 0) {
        setMerch([]);
        setGlobalMerch([]);
        setLoading(false);
        return;
      }

      // Extract unique merch IDs that this specific user owns
      const merchIds = [...new Set(links.map(l => l.merchId))];

      // Firestore 'in' queries have a strict limit of 30 items per batch, so we slice them up
      const batches = [];
      for (let i = 0; i < merchIds.length; i += 30) {
        batches.push(merchIds.slice(i, i + 30));
      }

      try {
        // Fetch the actual merchandise data in chunks of 30
        const merchPromises = batches.map(batch => {
          const q = query(collection(db, 'merchandise'), where(documentId(), 'in', batch));
          return getDocs(q);
        });

        const snapshots = await Promise.all(merchPromises);
        const fetchedMerch = [];
        snapshots.forEach(snap => {
          snap.docs.forEach(d => fetchedMerch.push({ id: d.id, ...d.data() }));
        });

        // Set globalMerch to ONLY what the user owns so ProfileBinders can still find its thumbnails!
        setGlobalMerch(fetchedMerch);

        // Merge the personal statuses (owned, wishlisted, etc.)
        const mergedMerch = fetchedMerch.map(item => {
          const link = links.find(l => l.merchId === item.id);
          return { ...item, status: link.status };
        });

        setMerch(mergedMerch);
      } catch (error) {
        console.error("Error fetching user merch:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => { unsubGroups(); unsubCollected(); };
  }, [userId]); 

  const saveProfile = async (editForm) => {
    if (!userId) return false;
    try {
      // Check if the user is trying to change their username
      if (editForm.username && editForm.username !== profileData.username) {
        const newUsername = editForm.username.toLowerCase();
        const oldUsername = profileData.username?.toLowerCase();

        // 1. Check if the new username is already taken by someone else
        const usernameSnap = await getDoc(doc(db, 'usernames', newUsername));
        if (usernameSnap.exists()) {
          setAlertMsg('That username is already taken!');
          return false; // Stop the save
        }

        // 2. Use a batch to safely perform all database actions at once
        const batch = writeBatch(db);

        // Create the new username document, carrying over their original email
        batch.set(doc(db, 'usernames', newUsername), {
          uid: userId,
          email: profileData.email || '' 
        });

        // Delete the old username document to free it up for others
        if (oldUsername) {
          batch.delete(doc(db, 'usernames', oldUsername));
        }

        // Update their main profile data
        batch.set(doc(db, 'profile', userId), editForm, { merge: true });

        await batch.commit();
      } else {
        // If they didn't change their username, just do a normal, simple save
        await setDoc(doc(db, 'profile', userId), editForm, { merge: true });
      }

      setProfileData(editForm);
      setAlertMsg('Profile updated successfully!');
      return true;
    } catch (error) {
      console.error(error);
      setAlertMsg('Database Error: ' + error.message);
      return false;
    }
  };

  return {
    merch,
    globalMerch,
    groups,
    loading,
    profileData,
    alertMsg,
    setAlertMsg,
    saveProfile,
  };
}