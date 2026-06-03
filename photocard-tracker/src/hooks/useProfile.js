import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';

const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23C2B0B4'/%3E%3Ctext x='150' y='160' text-anchor='middle' font-size='80' fill='%23312527' font-family='sans-serif'%3EKP%3C/text%3E%3C/svg%3E`;
const DEFAULT_BANNER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1000' height='250'%3E%3Crect width='1000' height='250' fill='%23D4C4C7'/%3E%3Ctext x='500' y='140' text-anchor='middle' font-size='40' fill='%236A585B' font-family='sans-serif'%3EYour Banner%3C/text%3E%3C/svg%3E`;

const DEFAULT_PROFILE = {
  name: "My K-Pop Collection",
  bio: "Collecting NewJeans, Stray Kids, and everything in between. 🌸",
  avatarUrl: DEFAULT_AVATAR,
  bannerUrl: DEFAULT_BANNER,
};

export function useProfile() {
  const [merch, setMerch] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(DEFAULT_PROFILE);
  const [alertMsg, setAlertMsg] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const profileSnap = await getDoc(doc(db, 'profile', 'main'));
      if (profileSnap.exists()) {
        setProfileData(profileSnap.data());
      }
    };
    fetchProfile();

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const q = query(collection(db, 'merchandise'), orderBy('addedAt', 'desc'));
    const unsubMerch = onSnapshot(q, (snapshot) => {
      setMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubGroups(); unsubMerch(); };
  }, []);

  const saveProfile = async (editForm) => {
    try {
      await setDoc(doc(db, 'profile', 'main'), editForm);
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