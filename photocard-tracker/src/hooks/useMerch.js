import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export function useMerch(user) {
  const [merch, setMerch] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setMerch([]);
      setLoading(false);
      return;
    }

    const fetchMerch = async () => {
      try {
        // This will now hit your free local browser cache first!
        const snapshot = await getDocs(collection(db, 'merchandise'));
        setMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching merch:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerch();
  }, [user?.uid]);

  return { merch, loading };
}