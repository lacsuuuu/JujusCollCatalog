import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, deleteField, query, where
} from 'firebase/firestore';

export function useBinders(user) {
  const [binders, setBinders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setBinders([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'binders'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setBinders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const createBinder = async ({ name, type }) => {
    await addDoc(collection(db, 'binders'), {
      userId: user.uid,
      name: name.trim(),
      type: Number(type),
      slots: {},
      coverPage: 0,
      totalPages: 1,
      isPublic: false,
      createdAt: new Date().toISOString(),
    });
  };

  const deleteBinder = async (id) => {
    await deleteDoc(doc(db, 'binders', id));
  };

  const updateBinder = async (id, updates) => {
    await updateDoc(doc(db, 'binders', id), updates);
  };

  const removeSlotsBatch = async (id, updates) => {
    await updateDoc(doc(db, 'binders', id), updates);
  };

  const togglePublic = async (id, currentValue) => {
    await updateDoc(doc(db, 'binders', id), { isPublic: !currentValue });
  };

  return { binders, loading, createBinder, deleteBinder, updateBinder, removeSlotsBatch, togglePublic };
}