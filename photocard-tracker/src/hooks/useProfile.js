import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where, doc, getDoc, setDoc } from 'firebase/firestore';

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
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(DEFAULT_PROFILE);
  const [alertMsg, setAlertMsg] = useState(null);

  // New independent state to hold the two data streams before merging
  const [globalMerch, setGlobalMerch] = useState([]);
  const [collectedLinks, setCollectedLinks] = useState([]);

  // Data Fetching Effect
  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const fetchProfile = async () => {
      const profileSnap = await getDoc(doc(db, 'profile', userId));
      if (profileSnap.exists()) {
        setProfileData(profileSnap.data());
      } else {
        setProfileData(DEFAULT_PROFILE); 
      }
    };
    fetchProfile();

    const groupsQuery = query(collection(db, 'groups'));
    const unsubGroups = onSnapshot(groupsQuery, (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 1. Fetch the entire Global Catalog
    const globalMerchQuery = query(collection(db, 'merchandise'), orderBy('addedAt', 'desc'));
    const unsubGlobalMerch = onSnapshot(globalMerchQuery, (snapshot) => {
      setGlobalMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Fetch only THIS user's links from the collected_items bridge table
    const collectedQuery = query(collection(db, 'collected_items'), where('userId', '==', userId));
    const unsubCollected = onSnapshot(collectedQuery, (snapshot) => {
      setCollectedLinks(snapshot.docs.map(d => d.data()));
    });

    return () => { unsubGroups(); unsubGlobalMerch(); unsubCollected(); };
  }, [userId]); 

  // Data Merging Effect
  useEffect(() => {
    // Only attempt to merge if we have fetched the global pool
    if (globalMerch.length > 0) {
      const userSpecificMerch = collectedLinks.map(link => {
        // Find the matching global item
        const matchedItem = globalMerch.find(item => item.id === link.merchId);
        if (matchedItem) {
          // Return the global item, but inject the user's personal "owned/wishlisted" status
          return { ...matchedItem, status: link.status };
        }
        return null;
      }).filter(Boolean); // Filter out any nulls if a global item was deleted

      setMerch(userSpecificMerch);
      setLoading(false);
    } else if (globalMerch.length === 0 && collectedLinks.length === 0) {
      // Handle the case where the database is entirely empty
      setLoading(false);
    }
  }, [globalMerch, collectedLinks]);

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