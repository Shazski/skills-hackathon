import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle, Trash2, Pencil, Home as HomeIcon } from 'lucide-react';
import LOGO from '../../assets/Logo.png';
import {
  createHome,
  getAllHomes,
  deleteHome,
  getRoomsByHomeId,
  getCompletedAnalysesByRoomId,
  type Home as FirebaseHome,
  updateHome,
  getHomesByUserId
} from '../../lib/firebaseService';
import { auth } from '../../lib/firebase';

interface Home {
  id: string;
  name: string;
  address: string;
  imageUrl?: string;
  hasAllRoomsAnalyzed?: boolean;
  hasAnyRoomAnalyzed?: boolean;
}

interface Toast {
  message: string;
  type: 'info' | 'success' | 'error';
}

export const Home = () => {
  const navigate = useNavigate();
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateHome, setShowCreateHome] = useState(false);
  const [creatingHome, setCreatingHome] = useState(false);
  const [deletingHome, setDeletingHome] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdHomeData, setCreatedHomeData] = useState<Home | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [newHome, setNewHome] = useState({
    name: '',
    address: '',
    imageUrl: ''
  });
  const [selectedImage, setSelectedImage] = useState<{ url: string; file: File } | null>(null);
  const [editingHome, setEditingHome] = useState<Home | null>(null);
  const [editHomeData, setEditHomeData] = useState({ name: '', address: '', imageUrl: '' });
  const [editImage, setEditImage] = useState<{ url: string; file: File } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleCardClick = (homeId: string) => {
    navigate(`/homes/${homeId}`);
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default');
    formData.append('cloud_name', import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name'}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload to Cloudinary: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.secure_url;
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage({ url: imageUrl, file: file });
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const checkHomeAnalysisStatus = async (homeId: string) => {
    try {
      const rooms = await getRoomsByHomeId(homeId);
      if (rooms.length === 0) return { hasAllRoomsAnalyzed: false, hasAnyRoomAnalyzed: false };
      const analysisPromises = rooms.map(room => getCompletedAnalysesByRoomId(room.id).then(analyses => {
        const completedVideoUrls = analyses.map(a => a.cloudinaryUrl || a.videoUrl);
        const allAnalyzed = room.videos.length > 0 && room.videos.every(url => completedVideoUrls.includes(url));
        return allAnalyzed;
      }));
      const analysisResults = await Promise.all(analysisPromises);
      const hasAllRoomsAnalyzed = analysisResults.length > 0 && analysisResults.every(Boolean);
      const hasAnyRoomAnalyzed = analysisResults.some(Boolean);
      return { hasAllRoomsAnalyzed, hasAnyRoomAnalyzed };
    } catch (error) {
      console.error('Error checking home analysis status:', error);
      return { hasAllRoomsAnalyzed: false, hasAnyRoomAnalyzed: false };
    }
  };

  useEffect(() => {
    const loadHomesAndAnalysisStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        const user = auth.currentUser;
        if (!user) {
          setError('User not authenticated');
          setLoading(false);
          return;
        }
        const firebaseHomes = await getHomesByUserId(user.uid);
        const homesWithAnalysisStatus = await Promise.all(
          firebaseHomes.map(async (firebaseHome) => {
            const analysisStatus = await checkHomeAnalysisStatus(firebaseHome.id);
            return {
              id: firebaseHome.id,
              name: firebaseHome.name,
              address: firebaseHome.address,
              imageUrl: firebaseHome.imageUrl,
              hasAllRoomsAnalyzed: analysisStatus.hasAllRoomsAnalyzed,
              hasAnyRoomAnalyzed: analysisStatus.hasAnyRoomAnalyzed
            };
          })
        );
        setHomes(homesWithAnalysisStatus);
      } catch (error) {
        setError(`Failed to load homes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    loadHomesAndAnalysisStatus();
  }, []);

  useEffect(() => {
    const handler = async (e: any) => {
      const homeId = e.detail?.homeId;
      if (!homeId) return;
      const analysisStatus = await checkHomeAnalysisStatus(homeId);
      setHomes(prevHomes => prevHomes.map(home =>
        home.id === homeId
          ? { ...home, hasAllRoomsAnalyzed: analysisStatus.hasAllRoomsAnalyzed, hasAnyRoomAnalyzed: analysisStatus.hasAnyRoomAnalyzed }
          : home
      ));
    };
    window.addEventListener('home-analysis-status-updated', handler);
    return () => window.removeEventListener('home-analysis-status-updated', handler);
  }, []);

  const handleCreateHome = async () => {
    if (newHome.name.trim() && newHome.address.trim()) {
      if (!selectedImage) {
        setToast({
          message: 'Please upload an image for your home!',
          type: 'error'
        });
        setTimeout(() => setToast(null), 4000);
        return;
      }
      try {
        setCreatingHome(true);
        let imageUrl = '';
        try {
          imageUrl = await uploadToCloudinary(selectedImage.file);
        } catch (error) {
          setToast({
            message: 'Failed to upload image. Please try again!',
            type: 'error'
          });
          setTimeout(() => setToast(null), 4000);
          setCreatingHome(false);
          return;
        }
        const user = auth.currentUser;
        if (!user) {
          setToast({ message: 'User not authenticated!', type: 'error' });
          setTimeout(() => setToast(null), 4000);
          setCreatingHome(false);
          return;
        }
        const homeData = {
          name: newHome.name,
          address: newHome.address,
          imageUrl,
          userId: user.uid
        };
        const homeId = await createHome(homeData);
        const newHomeData: Home = {
          id: homeId,
          name: newHome.name,
          address: newHome.address,
          imageUrl,
          hasAllRoomsAnalyzed: false,
          hasAnyRoomAnalyzed: false
        };
        setHomes(prev => [...prev, newHomeData]);
        setNewHome({ name: '', address: '', imageUrl: '' });
        setSelectedImage(null);
        setShowCreateHome(false);
        setCreatedHomeData(newHomeData);
        setShowSuccessModal(true);
        setError(null);
        setTimeout(() => {
          setShowSuccessModal(false);
          setCreatedHomeData(null);
        }, 5000);
      } catch (error) {
        setError(`Failed to create home: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setSuccess(null);
      } finally {
        setCreatingHome(false);
      }
    } else {
      if (!newHome.name.trim() || !newHome.address.trim()) {
        setToast({
          message: 'Please fill in both home name and address!',
          type: 'error'
        });
        setTimeout(() => setToast(null), 4000);
      }
    }
  };

  const handleDeleteHome = async (homeId: string) => {
    try {
      setDeletingHome(homeId);

      await deleteHome(homeId);


      setHomes(prev => prev.filter(home => home.id !== homeId));
      setShowDeleteConfirm(null);

      setError(null);
      setSuccess('Home deleted successfully!');

      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('Error deleting home:', error);
      setError(`Failed to delete home: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingHome(null);
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, type: "spring" as const, stiffness: 60 },
    }),
  };

  // Helper to fetch address suggestions (now using Mapbox)
  const fetchAddressSuggestions = async (input: string) => {
    if (!input || input.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    setAddressLoading(true);
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          input
        )}.json?autocomplete=true&types=address&access_token=${token}`
      );
      const data = await res.json();
      if (data.features && Array.isArray(data.features)) {
        setAddressSuggestions(data.features.map((f: any) => f.place_name));
      } else {
        setAddressSuggestions([]);
      }
    } catch {
      setAddressSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  };

  return (
    <div className="px-1 md:px-2 pb-20 md:pb-4 pt-6">
      {toast && (
        <motion.div
          className="fixed top-4 right-4 z-[9999] max-w-sm"
          initial={{ opacity: 0, x: 100, y: -20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 100, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className={`rounded-xl p-4 shadow-lg border ${toast.type === 'info'
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
            : toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">
                {toast.type === 'info' ? '💡' : toast.type === 'success' ? '✅' : '⚠️'}
              </span>
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <motion.h1
          className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2 cursor-pointer"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "tween", stiffness: 300 }}
        >
          🏠 Your Homes
        </motion.h1>
        <motion.div
          className="h-1 w-32 mx-auto bg-gradient-to-r from-blue-400 via-fuchsia-400 to-purple-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: "8rem" }}
          transition={{ delay: 0.5, duration: 0.8 }}
        />
        <motion.p
          className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mt-4 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          Explore Your Dream Space !
        </motion.p>
      </motion.div>
      <motion.div
        className="flex justify-end mb-6 me-14 mt-2"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {homes.length > 0 && (
          <Button
            onClick={() => setShowCreateHome(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-md px-6 py-3 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <HomeIcon className="w-5 h-5" />
            Create Home
          </Button>
        )}
      </motion.div>

      {error && (
        <motion.div
          className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        </motion.div>
      )}

      {success && (
        <motion.div
          className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <span className="text-lg">✅</span>
            <span>{success}</span>
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap justify-center gap-6 mt-8 mb-20">
        {loading ? (

          [...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="w-[280px] bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="h-48 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
              <div className="p-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse"></div>
                <div className="flex gap-2">
                  <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            </motion.div>
          ))
        ) : homes.length === 0 ? (

          <motion.div
            className="col-span-full flex flex-col items-center justify-center py-16 px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-6xl mb-6">🏠</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
              No Homes Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-8 max-w-md">
              Create your first home to start organizing rooms and analyzing them with AI.
              Each home can contain multiple rooms for comprehensive analysis.
            </p>
            <Button
              onClick={() => setShowCreateHome(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-md px-8 py-6 flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-300 text-lg cursor-pointer"
            >
              <span className="text-2xl">🏠</span>
              Create Your First Home
            </Button>
          </motion.div>
        ) : (
          homes.map((home, i) => (
            <motion.div
              key={home.id}
              className="group relative w-[280px] bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileHover={{ y: -5, scale: 1.02 }}
            >
              <div className="relative overflow-hidden h-48">
                <motion.img
                  src={home.imageUrl || LOGO}
                  alt={home.name}
                  className="w-full h-full object-cover cursor-pointer"
                  transition={{ duration: 0.3 }}
                  onClick={() => handleCardClick(home.id)}
                />

                {home.hasAllRoomsAnalyzed && (
                  <motion.div
                    className="absolute top-3 left-3 bg-green-500 text-white rounded-full p-1 shadow-lg"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </motion.div>
                )}
              </div>

              <div className="p-4">
                <motion.h3
                  className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-between"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <span className="truncate max-w-xs" title={home.name}>{home.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-blue-600 p-1 rounded-full cursor-pointer"
                      title="Edit Home"
                      onClick={e => {
                        e.stopPropagation();
                        setEditingHome(home);
                        setEditHomeData({ name: home.name, address: home.address, imageUrl: home.imageUrl || '' });
                        setEditImage(null);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-600 p-1 rounded-full cursor-pointer"
                      title="Delete Home"
                      disabled={deletingHome === home.id}
                      onClick={e => {
                        e.stopPropagation();
                        setShowDeleteConfirm(home.id);
                      }}
                    >
                      {deletingHome === home.id ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </motion.h3>
                <motion.div
                  className="flex items-center gap-3 mb-4 text-sm text-gray-600 dark:text-gray-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  {/* Pin Icon */}
                  <span className="flex-shrink-0 self-start">📍</span>
                  {/* Address Text */}
                  <span>{home.address}</span>
                </motion.div>

                {/* <div className="flex gap-2">
                  <Button
                    onClick={() => handleCardClick(home.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer px-2 py-1"
                    size="sm"
                  >
                    📬 View
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg cursor-pointer px-2 py-1"
                    size="sm"
                  >
                    ✉️ Send
                  </Button>
                </div> */}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {showCreateHome && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowCreateHome(false)}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🏠</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Create New Home
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Add a new home to your collection
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateHome(false)}
                  className="text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Home Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newHome.name}
                    onChange={(e) => setNewHome(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Downtown Apartment, Beach House"
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-md transition-all duration-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newHome.address}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewHome(prev => ({ ...prev, address: value }));
                        setAddressDropdownOpen(true);
                        if (debounceRef.current) clearTimeout(debounceRef.current);
                        debounceRef.current = setTimeout(() => {
                          fetchAddressSuggestions(value);
                        }, 300);
                      }}
                      placeholder="Enter home address"
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-md transition-all duration-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      autoComplete="off"
                      onFocus={() => setAddressDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setAddressDropdownOpen(false), 150)}
                    />
                    {addressDropdownOpen && (
                      <div className="absolute z-20 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {addressLoading ? (
                          <div className="px-4 py-2 text-gray-500 text-sm">Loading...</div>
                        ) : newHome.address.trim().length < 3 ? (
                          null
                        ) : (
                          addressSuggestions.map((suggestion, idx) => (
                            <div
                              key={idx}
                              className="px-4 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-800 dark:text-gray-100"
                              onMouseDown={() => {
                                setNewHome(prev => ({ ...prev, address: suggestion }));
                                setAddressDropdownOpen(false);
                              }}
                            >
                              {suggestion}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Home Image <span className="text-orange-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">(Recommended)</span>
                  </label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md p-6 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                    <input
                      id="home-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    {selectedImage ? (
                      <div className="relative">
                        <img
                          src={selectedImage.url}
                          alt="Selected home"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="home-image-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center space-y-2">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">Click to upload</span> or drag and drop
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            PNG, JPG, GIF up to 10MB
                          </div>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateHome(false)}
                    disabled={creatingHome}
                    className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateHome}
                    disabled={!newHome.name.trim() || !newHome.address.trim() || creatingHome || !selectedImage?.url}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    {creatingHome ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Creating...
                      </>
                    ) : (
                      <>
                        <HomeIcon className="w-5 h-5" />
                        {newHome.imageUrl}
                        Create Home
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showSuccessModal && createdHomeData && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowSuccessModal(false)}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">

              <motion.div
                className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <motion.div
                  className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle className="w-8 h-8 text-white" />
                </motion.div>
              </motion.div>

              <motion.h2
                className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Home Created Successfully!
              </motion.h2>

              <motion.div
                className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="text-4xl mb-3">🏠</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {createdHomeData.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  📍 {createdHomeData.address}
                </p>
                {createdHomeData.imageUrl && (
                  <div className="mt-3">
                    <img
                      src={createdHomeData.imageUrl}
                      alt={createdHomeData.name}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  </div>
                )}
              </motion.div>

              <motion.div
                className="flex gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  variant="outline"
                  onClick={() => setShowSuccessModal(false)}
                  className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Continue
                </Button>
                <Button
                  onClick={() => {
                    setShowSuccessModal(false);
                    handleCardClick(createdHomeData.id);
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <HomeIcon className="w-5 h-5" />
                  Open Home
                </Button>
              </motion.div>

              <motion.div
                className="mt-4 text-xs text-gray-500 dark:text-gray-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                This modal will close automatically in a few seconds
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showDeleteConfirm && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowDeleteConfirm(null)}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">

              <motion.div
                className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <motion.div
                  className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                >
                  <span className="text-2xl">⚠️</span>
                </motion.div>
              </motion.div>


              <motion.h2
                className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Delete Home?
              </motion.h2>

              <motion.p
                className="text-gray-600 dark:text-gray-400 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                This will permanently delete the home and all its rooms, videos, and analysis data. This action cannot be undone.
              </motion.p>

              <motion.div
                className="flex gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={deletingHome === showDeleteConfirm}
                  className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteHome(showDeleteConfirm!)}
                  disabled={deletingHome === showDeleteConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-2 cursor-pointer"
                >
                  {deletingHome === showDeleteConfirm ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <span className="text-lg">🗑️</span>
                      Delete Home
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {editingHome && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setEditingHome(null)}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🏠</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Home</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Update your home details</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditingHome(null)} className="text-gray-500 hover:text-gray-700 cursor-pointer">✕</Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Home Name</label>
                <input
                  type="text"
                  value={editHomeData.name}
                  onChange={e => setEditHomeData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 focus:border-yellow-500 dark:focus:border-yellow-400 rounded-xl transition-all duration-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editHomeData.address}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditHomeData(prev => ({ ...prev, address: value }));
                      setAddressDropdownOpen(true);
                      if (debounceRef.current) clearTimeout(debounceRef.current);
                      debounceRef.current = setTimeout(() => {
                        fetchAddressSuggestions(value);
                      }, 300);
                    }}
                    placeholder="Enter home address"
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-md transition-all duration-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoComplete="off"
                    onFocus={() => setAddressDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setAddressDropdownOpen(false), 150)}
                  />
                  {addressDropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {addressLoading ? (
                        <div className="px-4 py-2 text-gray-500 text-sm">Loading...</div>
                      ) : editHomeData.address.trim().length < 3 ? (
                        null
                      ) : (
                        addressSuggestions.map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="px-4 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-800 dark:text-gray-100"
                            onMouseDown={() => {
                              setEditHomeData(prev => ({ ...prev, address: suggestion }));
                              setAddressDropdownOpen(false);
                            }}
                          >
                            {suggestion}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Home Image</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-yellow-500 dark:hover:border-yellow-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setEditImage({ url, file });
                      }
                    }}
                    className="hidden"
                    id="edit-home-image-upload"
                  />
                  <label htmlFor="edit-home-image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    {editImage?.url ? (
                      <img src={editImage.url} alt="Home" className="w-24 h-24 object-cover rounded-xl mx-auto" />
                    ) : editHomeData.imageUrl ? (
                      <img src={editHomeData.imageUrl} alt="Home" className="w-24 h-24 object-cover rounded-xl mx-auto" />
                    ) : (
                      <span className="text-gray-400">Click to upload image</span>
                    )}
                    <span className="text-xs text-gray-500">JPG, PNG, or GIF</span>
                  </label>
                  {editImage?.url && (
                    <button type="button" className="mt-2 text-xs text-red-500 hover:underline" onClick={() => setEditImage(null)}>
                      Remove Image
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={() => setEditingHome(null)} className="px-6">Cancel</Button>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6"
                  disabled={savingEdit}
                  onClick={async () => {
                    setSavingEdit(true);
                    let imageUrl = editHomeData.imageUrl;
                    try {
                      if (editImage?.file) {
                        imageUrl = await uploadToCloudinary(editImage.file);
                      }
                      await updateHome(editingHome.id, {
                        name: editHomeData.name,
                        address: editHomeData.address,
                        imageUrl,
                      });
                      setHomes(prev => prev.map(h => h.id === editingHome.id ? { ...h, name: editHomeData.name, address: editHomeData.address, imageUrl } : h));
                      setEditingHome(null);
                      setEditImage(null);
                      setToast({ message: 'Home updated successfully!', type: 'success' });
                      setTimeout(() => setToast(null), 3000);
                    } catch (err) {
                      setToast({ message: 'Failed to update home. Please try again.', type: 'error' });
                      setTimeout(() => setToast(null), 4000);
                    } finally {
                      setSavingEdit(false);
                    }
                  }}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};