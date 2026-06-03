import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import ThemeAlert from '../ui/ThemeAlert';
import { deleteCloudinaryImage, uploadToCloudinary } from '../../utils/cloudinaryUtils';

const arrowStyle = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  background: 'rgba(49, 37, 39, 0.4)', backdropFilter: 'blur(4px)',
  color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px',
  cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
  transition: 'background 0.2s', zIndex: 10
};

export default function Feed({ user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [alertMsg, setAlertMsg] = useState(null);

  const BATCH_SIZE = 9;
  const [postLimit, setPostLimit] = useState(BATCH_SIZE);

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [expandedCaptions, setExpandedCaptions] = useState(new Set());
  const [viewingImage, setViewingImage] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState({});

  const [editingPost, setEditingPost] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [editPhotos, setEditPhotos] = useState([]);
  const [editPhotoIndex, setEditPhotoIndex] = useState(0);
  const [isDraggingEdit, setIsDraggingEdit] = useState(false);

  // Replaces the __CONFIRM_DELETE__ string hack
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(postLimit));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setHasMore(snapshot.docs.length === postLimit);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to feed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [postLimit]);

  const fetchMorePosts = () => setPostLimit(prev => prev + BATCH_SIZE);

  const formatPostDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleNextImage = (postId, maxLen, e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => ({ ...prev, [postId]: (prev[postId] || 0) === maxLen - 1 ? 0 : (prev[postId] || 0) + 1 }));
  };

  const handlePrevImage = (postId, maxLen, e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => ({ ...prev, [postId]: (prev[postId] || 0) === 0 ? maxLen - 1 : (prev[postId] || 0) - 1 }));
  };

  const handleDeleteClick = (postId) => {
    setActiveMenuId(null);
    setConfirmDeleteId(postId);
  };

  const confirmDelete = async () => {
    try {
      const postToDelete = posts.find(p => p.id === confirmDeleteId);
      if (postToDelete) {
        const urls = postToDelete.imageUrls || (postToDelete.imageUrl ? [postToDelete.imageUrl] : []);
        for (const url of urls) {
          if (url.includes('cloudinary.com')) await deleteCloudinaryImage(url);
        }
      }
      await deleteDoc(doc(db, "posts", confirmDeleteId));
    } catch {
      setAlertMsg("Failed to delete post.");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleEditClick = (post) => {
    setActiveMenuId(null);
    setEditingPost(post);
    setEditCaption(post.caption || '');
    setEditPhotos((post.imageUrls || (post.imageUrl ? [post.imageUrl] : [])).map(url => ({ url })));
    setEditPhotoIndex(0);
  };

  const handleEditFiles = (files) => {
    if (!files || files.length === 0) return;
    setEditPhotos(prev => [...prev, ...Array.from(files).map(file => ({ url: URL.createObjectURL(file), file }))]);
  };

  const handleEditDrop = (e) => {
    e.preventDefault();
    setIsDraggingEdit(false);
    if (e.dataTransfer.files) handleEditFiles(e.dataTransfer.files);
  };

  const handleEditDeletePhoto = (e) => {
    e.stopPropagation();
    setEditPhotos(prev => {
      const next = [...prev];
      next.splice(editPhotoIndex, 1);
      return next;
    });
    setEditPhotoIndex(prev => (prev >= editPhotos.length - 1 ? Math.max(0, prev - 1) : prev));
  };

  const saveEdit = async () => {
    if (editPhotos.length === 0) return setAlertMsg("Post must have at least one image.");
    setAlertMsg("Saving changes...");
    try {
      const finalUrls = await Promise.all(
        editPhotos.map(photo => photo.file ? uploadToCloudinary(photo.file) : photo.url)
      );

      await updateDoc(doc(db, "posts", editingPost.id), {
        caption: editCaption,
        imageUrls: finalUrls,
        imageUrl: finalUrls[0],
      });

      setEditingPost(null);
      setAlertMsg("Post updated!");
    } catch (error) {
      console.error("Edit error:", error);
      setAlertMsg("Failed to update post.");
    }
  };

  const toggleCaption = (id) => {
    setExpandedCaptions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>

      <style>{`
        .menu-item { padding: 0.7rem 1rem; cursor: pointer; color: #312527; font-size: 0.9rem; font-weight: 500; transition: background 0.2s; text-align: left; border: none; background: transparent; width: 100%; display: block; }
        .menu-item:hover { background: #D4C4C7; }
        .menu-item.danger { color: #A85A66; }
        .icon-btn:hover { background: rgba(49, 37, 39, 0.7) !important; }
        .del-btn:hover { filter: brightness(0.8); transform: scale(1.05); }
      `}</style>

      <ThemeAlert
        message={alertMsg}
        onClose={() => setAlertMsg(null)}
        hideButton={alertMsg === "Saving changes..."}
      />

      {activeMenuId && (
        <div onClick={() => setActiveMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(49, 37, 39, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#E6DADD', padding: '1.5rem 2rem', borderRadius: '12px', border: '1px solid #D4C4C7', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '320px', width: '90%' }}>
            <p style={{ color: '#312527', margin: '0 0 1.5rem 0', fontWeight: '600' }}>Are you sure you want to delete this post?</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={confirmDelete} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8D6E73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Delete</button>
              <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {viewingImage && (() => {
        const urls = viewingImage.imageUrls || (viewingImage.imageUrl ? [viewingImage.imageUrl] : []);
        const idx = currentImageIndex[viewingImage.id] || 0;
        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(49, 37, 39, 0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '2rem' }} onClick={() => setViewingImage(null)}>
            <button onClick={() => setViewingImage(null)} style={{ position: 'absolute', top: '20px', right: '30px', background: 'transparent', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', zIndex: 10001, padding: '1rem' }}>✕</button>
            <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#D4C4C7', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#8D6E73', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{formatPostDate(viewingImage.timestamp)}</p>
                <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.6', color: '#312527', whiteSpace: 'pre-wrap' }}>{viewingImage.caption}</p>
              </div>
              <div style={{ position: 'relative', padding: '0 0.5rem 0.5rem 0.5rem' }}>
                <img src={urls[idx]} alt="Full size" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', borderRadius: '6px', backgroundColor: '#C2B0B4' }} />
                {urls.length > 1 && (
                  <>
                    <button className="icon-btn" onClick={(e) => handlePrevImage(viewingImage.id, urls.length, e)} style={{...arrowStyle, left: '15px'}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button className="icon-btn" onClick={(e) => handleNextImage(viewingImage.id, urls.length, e)} style={{...arrowStyle, right: '15px'}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    <div style={{ position: 'absolute', bottom: '15px', right: '15px', color: '#FFF', fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'rgba(49, 37, 39, 0.6)', padding: '0.3rem 0.7rem', borderRadius: '20px', backdropFilter: 'blur(4px)', pointerEvents: 'none' }}>
                      {idx + 1} / {urls.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Post Modal */}
      {editingPost && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(49, 37, 39, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }} onClick={() => setEditingPost(null)}>
          <div style={{ backgroundColor: '#E6DADD', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, color: '#312527', fontSize: '1.4rem' }}>Edit Post</h3>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDraggingEdit(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDraggingEdit(false); }}
              onDrop={handleEditDrop}
              onClick={() => fileInputRef.current.click()}
              style={{ position: 'relative', width: '100%', height: '300px', backgroundColor: '#D4C4C7', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: isDraggingEdit ? '2px dashed #8D6E73' : '2px dashed transparent' }}
            >
              {editPhotos.length > 0 ? (
                <>
                  <img src={editPhotos[editPhotoIndex].url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                  <button
                    className="del-btn"
                    onClick={handleEditDeletePhoto}
                    style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#6A585B', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', zIndex: 15, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', backdropFilter: 'blur(4px)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>

                  {isDraggingEdit && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(141, 110, 115, 0.85)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#FFF', fontSize: '1.2rem', fontWeight: 'bold' }}>
                      Drop new photo here
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'linear-gradient(transparent, rgba(49,37,39,0.85))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#FFF' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.3rem 0.8rem', borderRadius: '20px', backdropFilter: 'blur(4px)' }}>
                      Add more
                    </span>
                    {editPhotos.length > 1 && (
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'rgba(49, 37, 39, 0.6)', padding: '0.3rem 0.7rem', borderRadius: '20px', backdropFilter: 'blur(4px)' }}>
                        {editPhotoIndex + 1} / {editPhotos.length}
                      </span>
                    )}
                  </div>

                  {editPhotos.length > 1 && (
                    <>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setEditPhotoIndex(prev => prev === 0 ? editPhotos.length - 1 : prev - 1); }} style={{...arrowStyle, left: '10px'}}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                      </button>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setEditPhotoIndex(prev => prev === editPhotos.length - 1 ? 0 : prev + 1); }} style={{...arrowStyle, right: '10px'}}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <p style={{ margin: 0 }}><img src="/frame.svg" alt="Frame" width="35" height="35" style={{ opacity: 0.7 }} /></p>
                  <p style={{ margin: '0.5rem 0 0.25rem', color: '#312527', fontSize: '0.9rem', fontWeight: '600' }}>Drop images here</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => handleEditFiles(e.target.files)} style={{ display: 'none' }} />

            <div>
              <label style={{ fontSize: '0.8rem', color: '#6A585B', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Caption</label>
              <textarea
                value={editCaption}
                onChange={e => setEditCaption(e.target.value)}
                rows="3"
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button onClick={saveEdit} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#8D6E73', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
              <button onClick={() => setEditingPost(null)} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', color: '#6A585B', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527', paddingBottom: '0.5rem', borderBottom: '1px solid #C2B0B4' }}>
        Collection Diary
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {posts.map(post => {
          const isExpanded = expandedCaptions.has(post.id);
          const urls = post.imageUrls || (post.imageUrl ? [post.imageUrl] : []);
          const idx = currentImageIndex[post.id] || 0;

          return (
            <div key={post.id} style={{ borderRadius: '12px', overflow: 'hidden', backgroundColor: '#D4C4C7', boxShadow: '0 4px 12px rgba(49,37,39,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#8D6E73', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '0.4rem' }}>
                    {formatPostDate(post.timestamp)}
                  </p>

                  {user && (
                    <div style={{ position: 'relative', zIndex: 95 }}>
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                        style={{ background: 'transparent', color: '#6A585B', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(49, 37, 39, 0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2.5"></circle>
                          <circle cx="12" cy="12" r="2.5"></circle>
                          <circle cx="12" cy="19" r="2.5"></circle>
                        </svg>
                      </button>

                      {activeMenuId === post.id && (
                        <div style={{ position: 'absolute', top: '100%', right: '0', backgroundColor: '#E6DADD', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '130px', overflow: 'hidden', zIndex: 100, border: '1px solid #C2B0B4' }}>
                          <button className="menu-item" onClick={() => handleEditClick(post)}>Edit Post</button>
                          <button className="menu-item danger" onClick={() => handleDeleteClick(post.id)}>Delete</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p style={{
                  margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: '#312527', whiteSpace: 'pre-wrap',
                  display: isExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: isExpanded ? 'unset' : 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: isExpanded ? 'visible' : 'hidden'
                }}>
                  {post.caption}
                </p>

                {post.caption && post.caption.length > 100 && (
                  <button
                    onClick={() => toggleCaption(post.id)}
                    style={{ background: 'none', border: 'none', color: '#8D6E73', fontWeight: 'bold', padding: '0.5rem 0 0 0', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                  >
                    {isExpanded ? 'Show less' : 'Read more...'}
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', padding: '0 0.5rem 0.5rem 0.5rem', marginTop: 'auto' }}>
                <img
                  src={urls[idx]}
                  alt="Feed post"
                  onClick={() => setViewingImage(post)}
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', borderRadius: '6px', cursor: 'zoom-in', backgroundColor: '#C2B0B4' }}
                />

                {urls.length > 1 && (
                  <>
                    <button className="icon-btn" onClick={(e) => handlePrevImage(post.id, urls.length, e)} style={{...arrowStyle, left: '15px'}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button className="icon-btn" onClick={(e) => handleNextImage(post.id, urls.length, e)} style={{...arrowStyle, right: '15px'}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    <div style={{ position: 'absolute', bottom: '15px', right: '15px', color: '#FFF', fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'rgba(49, 37, 39, 0.6)', padding: '0.3rem 0.7rem', borderRadius: '20px', backdropFilter: 'blur(4px)', pointerEvents: 'none' }}>
                      {idx + 1} / {urls.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        {loading && <p style={{ color: '#6A585B', fontSize: '0.9rem' }}>Loading...</p>}
        {!loading && hasMore && <button onClick={fetchMorePosts} style={{ padding: '0.6rem 2rem', backgroundColor: 'transparent', color: '#6A585B', border: '2px solid #8D6E73', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>Load More</button>}
        {!loading && !hasMore && posts.length > 0 && <p style={{ color: '#6A585B', fontSize: '0.85rem' }}>You've reached the end of the feed.</p>}
      </div>
    </div>
  );
}