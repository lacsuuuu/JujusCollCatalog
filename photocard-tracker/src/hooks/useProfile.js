import { useState, useEffect } from 'react';
import { db } from '../firebase';
// Added documentId and getDocs to handle the targeted chunk fetching
import { collection, onSnapshot, query, where, doc, getDoc, setDoc, documentId, getDocs } from 'firebase/firestore';

const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23C2B0B4'/%3E%3Ctext x='150' y='160' text-anchor='middle' font-size='80' fill='%23312527' font-family='sans-serif'%3EKP%3C/text%3E%3C/svg%3E`;
const DEFAULT_BANNER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1000' height='250'%3E%3Crect width='1000' height='250' fill='%23D4C4C7'/%3E%3Ctext x='500' y='140' text-anchor='middle' font-size='40' fill='%236A585B' font-family='sans-serif'%3EYour Banner%3C/text%3E%3C/svg%3E`;

const DEFAULT_PROFILE = {
  name: "My K-Pop Collection",
  bio: "Collecting NewJeans, Stray Kids, and everything in between. 🌸",
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
      await setDoc(doc(db, 'profile', userId), editForm, { merge: true });
      setProfileData(editForm);
      setAlertMsg('Profile updated successfully!');
      return true;
    } catch {
      setAlertMsg('Database Error.');
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
    defaultAvatar: DEFAULT_AVATAR,
    defaultBanner: DEFAULT_BANNER,
  };
}