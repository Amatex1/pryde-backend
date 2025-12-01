import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import './PhotoEssay.css';

function PhotoEssay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPhotoEssay();
    }
  }, [id]);

  const fetchPhotoEssay = async () => {
    try {
      const response = await api.get(`/photo-essays/${id}`);
      const essay = response.data;
      setTitle(essay.title);
      setPhotos(essay.photos || []);
      setVisibility(essay.visibility);
      setEditMode(true);
    } catch (error) {
      console.error('Failed to fetch photo essay:', error);
      showToast('Failed to load photo essay', 'error');
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingPhoto(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('media', file);

        const response = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setPhotos(prev => [...prev, { url: response.data.url, caption: '' }]);
      }
      showToast('Photos uploaded successfully', 'success');
    } catch (error) {
      console.error('Failed to upload photos:', error);
      showToast('Failed to upload photos', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updateCaption = (index, caption) => {
    setPhotos(prev => prev.map((photo, i) => i === index ? { ...photo, caption } : photo));
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || photos.length === 0) {
      showToast('Please add a title and at least one photo', 'error');
      return;
    }

    setLoading(true);
    try {
      const data = { title, photos, visibility };
      
      if (editMode) {
        await api.put(`/photo-essays/${id}`, data);
        showToast('Photo essay updated successfully', 'success');
      } else {
        await api.post('/photo-essays', data);
        showToast('Photo essay created successfully', 'success');
      }
      
      navigate('/profile');
    } catch (error) {
      console.error('Failed to save photo essay:', error);
      showToast('Failed to save photo essay', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="photo-essay-page">
      <Navbar />
      <Toast {...toast} />
      
      <div className="photo-essay-container">
        <div className="photo-essay-header glossy">
          <h1>📸 {editMode ? 'Edit' : 'Create'} Photo Essay</h1>
          <p>Tell a visual story with your photos</p>
        </div>

        <form onSubmit={handleSubmit} className="photo-essay-form glossy">
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your photo essay a title..."
              className="input-field glossy"
              required
            />
          </div>

          <div className="form-group">
            <label>Photos</label>
            <div className="photo-upload-area">
              <label className="upload-button glossy-gold">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  style={{ display: 'none' }}
                />
                {uploadingPhoto ? '⏳ Uploading...' : '📷 Add Photos'}
              </label>
            </div>

            {photos.length > 0 && (
              <div className="photos-grid">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-item glossy">
                    <img src={getImageUrl(photo.url)} alt={`Photo ${index + 1}`} />
                    <button
                      type="button"
                      className="remove-photo-btn"
                      onClick={() => removePhoto(index)}
                    >
                      ✕
                    </button>
                    <input
                      type="text"
                      value={photo.caption}
                      onChange={(e) => updateCaption(index, e.target.value)}
                      placeholder="Add a caption..."
                      className="caption-input glossy"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="select-field glossy"
            >
              <option value="public">🌍 Public</option>
              <option value="followers">👥 Followers</option>
              <option value="private">🔒 Only Me</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingPhoto}
              className="btn-primary glossy-gold"
            >
              {loading ? 'Saving...' : editMode ? 'Update Essay' : 'Create Essay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PhotoEssay;

