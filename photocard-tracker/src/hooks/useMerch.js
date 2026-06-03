import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
 
export function useMerch(user) {
  const [merch, setMerch] = useState([]);
 
  useEffect(() => {
    if (!user?.uid) {
      setMerch([]);
      return;
    }
 
    const unsub = onSnapshot(collection(db, 'merchandise'), (snapshot) => {
      setMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
 
    return () => unsub();
  }, [user?.uid]);
 
  return { merch };
}