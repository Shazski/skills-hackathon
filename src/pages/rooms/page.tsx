import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router';
import {
  Video,
  Upload,
  Play,
  Pause,
  Square,
  ArrowLeft,
  Plus,
  Trash2,
  Camera,
  Save
} from 'lucide-react';

interface Room {
  id: string;
  name: string;
  icon: string;
  videos: string[];
  description: string;
}

export const Rooms = () => {
  const { homeId } = useParams();
  const [rooms, setRooms] = useState<Room[]>([
    {
      id: '1',
      name: 'Kitchen',
      icon: '🍳',
      videos: [],
      description: 'Modern kitchen with all appliances'
    },
    {
      id: '2',
      name: 'Living Room',
      icon: '🛋️',
      videos: [],
      description: 'Spacious living area with natural light'
    },
    {
      id: '3',
      name: 'Master Bedroom',
      icon: '🛏️',
      videos: [],
      description: 'Comfortable master suite'
    },
    {
      id: '4',
      name: 'Bathroom',
      icon: '🚿',
      videos: [],
      description: 'Clean and modern bathroom'
    },
    {
      id: '5',
      name: 'Dining Room',
      icon: '🍽️',
      videos: [],
      description: 'Elegant dining space'
    },
    {
      id: '6',
      name: 'Study',
      icon: '📚',
      videos: [],
      description: 'Quiet workspace for productivity'
    }
  ]);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideos, setRecordedVideos] = useState<string[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([]);
  const [isLiveRecording, setIsLiveRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [currentRoomVideos, setCurrentRoomVideos] = useState<string[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    icon: '🏠',
    description: ''
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startLiveRecording = async () => {
    setIsStartingRecording(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        setRecordedVideos(prev => [...prev, videoUrl]);
        setIsLiveRecording(false);
      };

      mediaRecorder.start();
      setIsLiveRecording(true);
      setIsStartingRecording(false);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsStartingRecording(false);
    }
  };

  const stopLiveRecording = () => {
    if (mediaRecorderRef.current && isLiveRecording) {
      mediaRecorderRef.current.stop();
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());

      // Clear the video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const videoUrl = URL.createObjectURL(file);
        setUploadedVideos(prev => [...prev, videoUrl]);
      });
    }
  };

  const removeVideo = (index: number, type: 'recorded' | 'uploaded') => {
    if (type === 'recorded') {
      setRecordedVideos(prev => prev.filter((_, i) => i !== index));
    } else {
      setUploadedVideos(prev => prev.filter((_, i) => i !== index));
    }
  };

  const saveVideosToRoom = async () => {
    if (selectedRoom) {
      setIsSaving(true);

      setTimeout(() => {
        const loaderElement = document.querySelector('[data-loader="true"]');
        if (loaderElement) {
          loaderElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 50);

      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 2000));

      const allVideos = [...recordedVideos, ...uploadedVideos];
      const updatedRooms = rooms.map(room =>
        room.id === selectedRoom.id
          ? { ...room, videos: [...room.videos, ...allVideos] }
          : room
      );
      setRooms(updatedRooms);

      // Update selected room with new videos
      const updatedSelectedRoom = updatedRooms.find(room => room.id === selectedRoom.id);
      if (updatedSelectedRoom) {
        setSelectedRoom(updatedSelectedRoom);
        setCurrentRoomVideos(updatedSelectedRoom.videos);
      }

      // Clear temporary videos
      setRecordedVideos([]);
      setUploadedVideos([]);
      setIsSaving(false);
    }
  };

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setCurrentRoomVideos(room.videos);
    setRecordedVideos([]);
    setUploadedVideos([]);

    // Clear any existing video stream when switching rooms
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveRecording(false);
  };

  const handleCreateRoom = () => {
    if (newRoom.name.trim() && newRoom.description.trim()) {
      const roomIcons = ['🏠', '🍳', '🛋️', '🛏️', '🚿', '🍽️', '📚', '🏃‍♂️', '🎮', '🧘‍♀️', '🏋️‍♂️', '🎨', '🎵', '🌱', '🐕'];
      const randomIcon = roomIcons[Math.floor(Math.random() * roomIcons.length)];

      const newRoomData: Room = {
        id: Date.now().toString(),
        name: newRoom.name,
        icon: randomIcon,
        videos: [],
        description: newRoom.description
      };

      setRooms(prev => [...prev, newRoomData]);
      console.log('New room created:', newRoomData);
      setNewRoom({ name: '', icon: '🏠', description: '' });
      setShowCreateRoom(false);
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

  return (
    <div className="px-4 md:px-12 pb-20 md:pb-4">
      <motion.div
        className="flex items-center gap-4 mb-8"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link to="/home">
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Homes
          </Button>
        </Link>
        <motion.h1
          className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          🏠 Home {homeId} - Rooms
        </motion.h1>
      </motion.div>

      <motion.div
        className="flex justify-end mb-6"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <Button
          onClick={() => setShowCreateRoom(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl px-6 py-3 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Plus className="w-5 h-5" />
          Create Room
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {rooms.map((room, i) => (
          <motion.div
            key={room.id}
            className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-xl transition-all duration-300"
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            onClick={() => handleRoomClick(room)}
            whileHover={{ y: -5, scale: 1.02 }}
          >
            <div className="p-6">
              <div className="text-4xl mb-4">{room.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {room.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {room.description}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Video className="w-4 h-4" />
                <span>{room.videos.length} videos</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedRoom && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setSelectedRoom(null);
            // Clear video stream when closing modal
            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }
            setIsLiveRecording(false);
          }}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedRoom.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedRoom.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {selectedRoom.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedRoom(null);
                    // Clear video stream when closing modal
                    if (videoRef.current) {
                      videoRef.current.srcObject = null;
                    }
                    setIsLiveRecording(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-6">

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Live Recording
                </h3>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 mb-4 border border-gray-200 dark:border-gray-700 shadow-lg">
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-full h-72 bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-600 rounded-xl mb-4 shadow-inner border-2 border-gray-200 dark:border-gray-600"
                    />

                    {isLiveRecording && (
                      <motion.div
                        className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.div
                          className="w-2 h-2 bg-white rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                        LIVE
                      </motion.div>
                    )}

                    {!isLiveRecording && !videoRef.current?.srcObject && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-8 flex flex-col items-center justify-center">
                          <Camera className="w-16 h-16 text-white/70 mb-3" />
                          <p className="text-white/80 text-sm text-center">Camera Preview</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {isStartingRecording ? (
                      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        <span>Initializing Camera...</span>
                      </div>
                    ) : !isLiveRecording ? (
                      <Button
                        onClick={startLiveRecording}
                        className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:cursor-pointer"
                      >
                        <motion.div
                          whileHover={{
                            scale: 1.3,
                            rotate: 360,
                            transition: { duration: 0.6, ease: "easeInOut" }
                          }}
                          className="relative"
                        >
                          <motion.div
                            animate={{
                              boxShadow: [
                                "0 0 0 0 rgba(239, 68, 68, 0.4)",
                                "0 0 0 8px rgba(239, 68, 68, 0)",
                                "0 0 0 0 rgba(239, 68, 68, 0)"
                              ]
                            }}
                            transition={{
                              duration: 2.5,
                              repeat: Infinity,
                              ease: "easeOut"
                            }}
                            className="absolute inset-0 rounded-full"
                          />
                          <motion.div
                            animate={{
                              background: [
                                "linear-gradient(45deg, #ef4444, #dc2626)",
                                "linear-gradient(45deg, #dc2626, #b91c1c)",
                                "linear-gradient(45deg, #b91c1c, #ef4444)"
                              ]
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "linear"
                            }}
                            className="p-1 rounded-full"
                          >
                            <Video className="w-5 h-5 text-white drop-shadow-lg" />
                          </motion.div>
                        </motion.div>
                        Start Recording
                      </Button>
                    ) : (
                      <Button
                        onClick={stopLiveRecording}
                        className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:cursor-pointer"
                      >
                        <Square className="w-5 h-5" />
                        Stop Recording
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-blue-700 dark:text-blue-300 text-sm">
                      💡 <strong>Tip:</strong> Make sure you have good lighting and a stable camera position for the best recording quality.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Videos
                </h3>

                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className="cursor-pointer flex flex-col items-center gap-3"
                  >
                    <Upload className="w-8 h-8 text-gray-400" />
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">
                        Click to upload videos or drag and drop
                      </p>
                      <p className="text-sm text-gray-500">
                        MP4, WebM, or MOV files
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              {currentRoomVideos.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {selectedRoom.name} Videos ({currentRoomVideos.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentRoomVideos.map((video, index) => (
                      <div key={index} className="relative group">
                        <video
                          src={video}
                          controls
                          className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer hover:text-white"
                          onClick={() => {
                            const updatedVideos = currentRoomVideos.filter((_, i) => i !== index);
                            setCurrentRoomVideos(updatedVideos);
                            const updatedRooms = rooms.map(room =>
                              room.id === selectedRoom.id
                                ? { ...room, videos: updatedVideos }
                                : room
                            );
                            setRooms(updatedRooms);
                            setSelectedRoom(prev => prev ? { ...prev, videos: updatedVideos } : null);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recordedVideos.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    New Recorded Videos ({recordedVideos.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recordedVideos.map((video, index) => (
                      <div key={index} className="relative group">
                        <video
                          src={video}
                          controls
                          className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer hover:text-white"
                          onClick={() => removeVideo(index, 'recorded')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadedVideos.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    New Uploaded Videos ({uploadedVideos.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uploadedVideos.map((video, index) => (
                      <div key={index} className="relative group">
                        <video
                          src={video}
                          controls
                          className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer hover:text-white"
                          onClick={() => removeVideo(index, 'uploaded')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(recordedVideos.length > 0 || uploadedVideos.length > 0) && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  {isSaving ? (
                    <div
                      data-loader="true"
                      className="w-full bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-6 text-center"
                    >
                      <motion.div
                        className="flex flex-col items-center gap-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        <div className="flex gap-2">
                          {[...Array(3)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"
                              animate={{
                                y: [0, -10, 0],
                                scale: [1, 1.2, 1],
                                rotate: [0, 5, -5, 0]
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: "easeInOut"
                              }}
                            >
                              <Video className="w-4 h-4 text-white" />
                            </motion.div>
                          ))}
                        </div>

                        <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                          <motion.div
                            className="h-full bg-white rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2, ease: "easeInOut" }}
                          />
                        </div>

                        <motion.div
                          className="text-white font-semibold"
                          animate={{ opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          Saving videos to {selectedRoom.name}...
                        </motion.div>

                        <motion.div
                          className="text-white/80 text-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1 }}
                        >
                          ✨ Processing and optimizing your videos
                        </motion.div>
                      </motion.div>
                    </div>
                  ) : (
                    <Button
                      onClick={saveVideosToRoom}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center justify-center gap-2 py-3 text-lg transition-all duration-300 hover:scale-105 hover:cursor-pointer"
                    >
                      <Save className="w-5 h-5" />
                      Save Videos to {selectedRoom.name}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {showCreateRoom && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowCreateRoom(false)}
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
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Create New Room
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Add a new room to your home
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateRoom(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Room Name
                  </label>
                  <input
                    type="text"
                    value={newRoom.name}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Home Office, Game Room"
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-xl transition-all duration-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newRoom.description}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your room..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-xl transition-all duration-300 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateRoom(false)}
                    className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={!newRoom.name.trim() || !newRoom.description.trim()}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Create Room
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}; 