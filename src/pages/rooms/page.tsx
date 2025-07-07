import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import {
  Video,
  Upload,
  Square,
  ArrowLeft,
  Plus,
  Trash2,
  Camera,
  Save,
  Download,
  CheckCircle
} from 'lucide-react';
import { extractFramesFromVideo } from '../../lib/utils';
import {
  createRoom,
  getRoomsByHomeId,
  updateRoomVideos,
  createVideoAnalysis,
  updateVideoAnalysisResults,
  getCompletedAnalysesByRoomId,
  getVideoAnalysesByRoomId,
  testFirebaseConnection,
  deleteRoom,
  getHomeById,
  type Room as FirebaseRoom,
  type VideoAnalysis,
  type Home as FirebaseHome,
  deleteVideoAnalysis
} from '../../lib/firebaseService';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface Room {
  id: string;
  name: string;
  icon: string;
  videos: string[];
  description: string;
  analysisResults?: { [videoUrl: string]: { items: string[]; missingItems: string[] } };
  hasCompletedAnalysis?: boolean;
}

interface Home {
  id: string;
  name: string;
  address: string;
  imageUrl?: string;
  hasAllRoomsAnalyzed?: boolean;
}

export const Rooms = () => {
  const { homeId } = useParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [home, setHome] = useState<Home | null>(null);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [recordedVideos, setRecordedVideos] = useState<{ url: string; file?: File }[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<{ url: string; file: File }[]>([]);
  const [isLiveRecording, setIsLiveRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [currentRoomVideos, setCurrentRoomVideos] = useState<string[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState<'save-analyze' | 'save-only' | null>(null);
  const [showAnalysisResults, setShowAnalysisResults] = useState(false);
  const [analyzingVideos, setAnalyzingVideos] = useState<Set<string>>(new Set());
  const [videoAnalysis, setVideoAnalysis] = useState<{ [key: string]: { items: string[], missingItems: string[] } }>({});
  const [newRoom, setNewRoom] = useState({
    name: '',
    icon: '🏠',
    description: ''
  });
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdRoomData, setCreatedRoomData] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const [firebaseAnalyses, setFirebaseAnalyses] = useState<any[]>([]);

  useEffect(() => {
    const loadRooms = async () => {
      if (!homeId) return;

      try {
        setLoading(true);
        setError(null);
        console.log('Loading rooms for homeId:', homeId);

        const homeData = await getHomeById(homeId);
        if (homeData) {
          setHome(homeData);
        } else {
          setError('Home not found');
          setLoading(false);
          return;
        }

        const firebaseRooms = await getRoomsByHomeId(homeId);

        const roomsWithAnalysisStatus = await Promise.all(
          firebaseRooms.map(async (firebaseRoom) => {
            const completedAnalyses = await getCompletedAnalysesByRoomId(firebaseRoom.id);
            // Only count analyses for videos that still exist in the room
            const completedVideoUrls = completedAnalyses.map(a => a.cloudinaryUrl || a.videoUrl);
            const hasCompletedAnalysis = firebaseRoom.videos.length > 0 && firebaseRoom.videos.every(url => completedVideoUrls.includes(url));
            return {
              id: firebaseRoom.id,
              name: firebaseRoom.name,
              icon: firebaseRoom.icon,
              videos: firebaseRoom.videos,
              description: firebaseRoom.description,
              hasCompletedAnalysis
            };
          })
        );

        console.log('Rooms with analysis status:', roomsWithAnalysisStatus);
        setRooms(roomsWithAnalysisStatus);
      } catch (error) {
        console.error('Error loading rooms:', error);
        setError(`Failed to load rooms: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadRooms();
  }, [homeId]);

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
        const videoFile = new File([blob], `recorded-video-${Date.now()}.webm`, { type: 'video/webm' });
        setRecordedVideos(prev => [...prev, { url: videoUrl, file: videoFile }]);
        setIsLiveRecording(false);
      };

      mediaRecorder.start();
      setIsLiveRecording(true);
      setIsStartingRecording(false);
    } catch (error) {
      setIsStartingRecording(false);
    }
  };

  const stopLiveRecording = () => {
    if (mediaRecorderRef.current && isLiveRecording) {
      mediaRecorderRef.current.stop();
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const videoUrl = URL.createObjectURL(file);
      setUploadedVideos(prev => [...prev, { url: videoUrl, file }]);
      // Do not clear recordedVideos
    }
  };

  const removeVideo = (index: number, type: 'recorded' | 'uploaded') => {
    if (type === 'recorded') {
      const videoToRemove = recordedVideos[index];
      setRecordedVideos(prev => prev.filter((_, i) => i !== index));

      setVideoAnalysis(prev => {
        const newAnalysis = { ...prev };
        delete newAnalysis[videoToRemove.url];
        return newAnalysis;
      });
    } else {
      const videoToRemove = uploadedVideos[index];
      setUploadedVideos(prev => prev.filter((_, i) => i !== index));


      setVideoAnalysis(prev => {
        const newAnalysis = { ...prev };
        delete newAnalysis[videoToRemove.url];
        return newAnalysis;
      });
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default');
    formData.append('cloud_name', import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name');

    const isImage = file.type.startsWith('image/');
    const resourceType = isImage ? 'image' : 'video';

    const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name'}/${resourceType}/upload`, {
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

  const analyzeVideoWithAI = async (videoUrl: string, videoIndex: number, videoFile?: File, cloudinaryUrl?: string) => {
    try {
      let frameImageUrls: string[] = [];


      if (videoFile) {
        const frames = await extractFramesFromVideo(videoFile, 2)


        for (let i = 0; i < frames.length; i++) {
          const frameFile = new File([frames[i]], `frame_${i}.jpg`, { type: 'image/jpeg' });
          const url = await uploadToCloudinary(frameFile);
          frameImageUrls.push(url);
        }
      } else {

        frameImageUrls = [cloudinaryUrl || videoUrl];
      }

      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key is missing. Please check your environment variables.');
      }

      const openaiContent = [
        {
          type: 'text',
          text: 'Please analyze these video frames and list all the items, furniture, appliances, and objects you can see. Focus on items that would be relevant for a home or room analysis.'
        },
        ...frameImageUrls.map(url => ({
          type: 'image_url',
          image_url: { url }
        }))
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert at analyzing video content and identifying objects, items, and elements present in videos. \n\nYour task is to watch the provided video frames and create a comprehensive list of all visible items, objects, furniture, appliances, decorations, and any other notable elements you can identify.\n\nPlease provide your response in the following format:\n- List each item on a separate line\n- Be specific and descriptive\n- Include furniture, electronics, decorations, appliances, etc.\n- Mention the approximate location or context if relevant\n- Focus on items that would be important for real estate or home analysis\n\nFormat your response as a clean list with each item clearly described.`,
            },
            {
              role: "user",
              content: openaiContent,
            },
          ],
          max_tokens: 1000,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const analysisResult = data.choices?.[0]?.message?.content || "No items detected in the video.";


      const lines = analysisResult.split('\n').filter((line: string) => line.trim());
      const items: string[] = [];

      lines.forEach((line: string) => {
        if (line.includes('-') || line.includes('•') || line.includes('*')) {
          const item = line.replace(/^[-•*]\s*/, '').trim();
          if (item) items.push(item);
        } else if (line.match(/^\d+\./)) {
          const item = line.replace(/^\d+\.\s*/, '').trim();
          if (item) items.push(item);
        } else if (line.trim() && !line.toLowerCase().includes('difference') && !line.toLowerCase().includes('image')) {
          items.push(line.trim());
        }
      });

      const analysisKey = cloudinaryUrl || videoUrl;

      const analysisData = {
        items: items,
        missingItems: []
      };

      setVideoAnalysis(prev => ({
        ...prev,
        [analysisKey]: analysisData
      }));


      if (selectedRoom) {
        try {

          const firebaseAnalysisId = await createVideoAnalysis(selectedRoom.id, videoUrl, cloudinaryUrl);


          await updateVideoAnalysisResults(firebaseAnalysisId, items, [], cloudinaryUrl);

          const completedAnalyses = await getCompletedAnalysesByRoomId(selectedRoom.id);
          const completedVideoUrls = completedAnalyses.map(a => a.cloudinaryUrl || a.videoUrl);
          const hasCompletedAnalysis = selectedRoom.videos.length > 0 && selectedRoom.videos.every(url => completedVideoUrls.includes(url));
          setRooms(prev => prev.map(room =>
            room.id === selectedRoom.id
              ? { ...room, hasCompletedAnalysis }
              : room
          ));
          window.dispatchEvent(new CustomEvent('home-analysis-status-updated', { detail: { homeId: homeId || (home && home.id) } }));

          saveAnalysisResults(selectedRoom.id, analysisKey, analysisData);
        } catch (error) {
          console.error('Error saving analysis to Firebase:', error);
        }
      }

      setAnalyzingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoUrl);
        return newSet;
      });

    } catch (error) {

      setAnalyzingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoUrl);
        return newSet;
      });
      throw error;
    }
  };

  const saveVideosToRoom = async () => {
    if (selectedRoom) {
      setIsProcessing(true);
      setProcessingProgress(0);
      setCurrentOperation('save-analyze');

      clearAllAnalysisResults();

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


      const allVideos = [
        ...recordedVideos.map(v => ({ url: v.url, file: v.file, type: 'recorded' as const })),
        ...uploadedVideos.map(v => ({ url: v.url, file: v.file, type: 'uploaded' as const }))
      ];

      const allVideoUrls = allVideos.map(v => v.url);

      setAnalyzingVideos(new Set(allVideoUrls));

      setProcessingProgress(5);
      await new Promise(resolve => setTimeout(resolve, 300));
      setProcessingProgress(10);
      await new Promise(resolve => setTimeout(resolve, 200));
      setProcessingProgress(15);


      setProcessingProgress(18);
      const cloudinaryUrls: string[] = [];

      for (let i = 0; i < allVideos.length; i++) {
        const video = allVideos[i];
        if (video.file) {
          try {
            const cloudinaryUrl = await uploadToCloudinary(video.file);
            cloudinaryUrls.push(cloudinaryUrl);
            console.log(`Video ${i + 1} uploaded to Cloudinary:`, cloudinaryUrl);
          } catch (error) {
            console.error(`Failed to upload video ${i + 1} to Cloudinary:`, error);
            cloudinaryUrls.push(video.url);
          }
        } else {
          cloudinaryUrls.push(video.url);
        }

        const progress = 18 + ((i + 1) / allVideos.length) * 7;
        setProcessingProgress(Math.round(progress));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setProcessingProgress(25);


      const analysisProgressRange = 70;
      const progressPerVideo = analysisProgressRange / allVideos.length;

      for (let i = 0; i < allVideos.length; i++) {
        const video = allVideos[i];
        const cloudinaryUrl = cloudinaryUrls[i];


        const videoStartProgress = 25 + (i * progressPerVideo);
        setProcessingProgress(Math.round(videoStartProgress));
        await new Promise(resolve => setTimeout(resolve, 200));


        const midProgress1 = videoStartProgress + (progressPerVideo * 0.3);
        setProcessingProgress(Math.round(midProgress1));
        await new Promise(resolve => setTimeout(resolve, 800));

        const midProgress2 = videoStartProgress + (progressPerVideo * 0.6);
        setProcessingProgress(Math.round(midProgress2));
        await new Promise(resolve => setTimeout(resolve, 600));


        await analyzeVideoWithAI(video.url, i, video.file, cloudinaryUrl);

        const videoEndProgress = 25 + ((i + 1) * progressPerVideo);
        setProcessingProgress(Math.round(videoEndProgress));


        await new Promise(resolve => setTimeout(resolve, 300));
      }


      setProcessingProgress(95);
      await new Promise(resolve => setTimeout(resolve, 500));


      try {
        await updateRoomVideos(selectedRoom.id, [...selectedRoom.videos, ...cloudinaryUrls]);


        const updatedRooms = rooms.map(room =>
          room.id === selectedRoom.id
            ? { ...room, videos: [...room.videos, ...cloudinaryUrls] }
            : room
        );
        setRooms(updatedRooms);
        const updatedSelectedRoom = updatedRooms.find(room => room.id === selectedRoom.id);
        if (updatedSelectedRoom) {
          setSelectedRoom(updatedSelectedRoom);
          setCurrentRoomVideos(updatedSelectedRoom.videos);
        }
      } catch (error) {
        console.error('Error saving videos to Firebase:', error);
      }


      setRecordedVideos([]);
      setUploadedVideos([]);


      setIsProcessing(false);
      setProcessingProgress(0);
      setCurrentOperation(null);

      setTimeout(() => {
        setShowAnalysisResults(true);
      }, 100);
    }
  };


  const saveAnalysisResults = (roomId: string, videoUrl: string, analysis: { items: string[]; missingItems: string[] }) => {
    const storageKey = `room_analysis_${roomId}`;
    const existingResults = JSON.parse(localStorage.getItem(storageKey) || '{}');
    existingResults[videoUrl] = analysis;
    localStorage.setItem(storageKey, JSON.stringify(existingResults));
  };


  const loadAnalysisResults = (roomId: string) => {
    const storageKey = `room_analysis_${roomId}`;
    const results = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return results;
  };


  const clearAllAnalysisResults = () => {
    setVideoAnalysis({});
    setShowAnalysisResults(false);
  };

  const saveVideosOnly = async () => {
    if (selectedRoom) {
      setIsProcessing(true);
      setProcessingProgress(0);
      setCurrentOperation('save-only');


      clearAllAnalysisResults();

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


      const allVideos = [
        ...recordedVideos.map(v => ({ url: v.url, file: v.file, type: 'recorded' as const })),
        ...uploadedVideos.map(v => ({ url: v.url, file: v.file, type: 'uploaded' as const }))
      ];

      const allVideoUrls = allVideos.map(v => v.url);

      setProcessingProgress(5);
      await new Promise(resolve => setTimeout(resolve, 200));
      setProcessingProgress(10);
      await new Promise(resolve => setTimeout(resolve, 300));
      setProcessingProgress(15);


      setProcessingProgress(18);
      const cloudinaryUrls: string[] = [];

      for (let i = 0; i < allVideos.length; i++) {
        const video = allVideos[i];
        if (video.file) {
          try {
            const cloudinaryUrl = await uploadToCloudinary(video.file);
            cloudinaryUrls.push(cloudinaryUrl);
            console.log(`Video ${i + 1} uploaded to Cloudinary:`, cloudinaryUrl);
          } catch (error) {
            console.error(`Failed to upload video ${i + 1} to Cloudinary:`, error);

            cloudinaryUrls.push(video.url);
          }
        } else {
          cloudinaryUrls.push(video.url);
        }

        const progress = 18 + ((i + 1) / allVideos.length) * 27;
        setProcessingProgress(Math.round(progress));
        await new Promise(resolve => setTimeout(resolve, 300 + (i * 100)));
      }
      setProcessingProgress(45);


      setProcessingProgress(50);
      await new Promise(resolve => setTimeout(resolve, 400));
      setProcessingProgress(60);
      await new Promise(resolve => setTimeout(resolve, 500));
      setProcessingProgress(70);
      await new Promise(resolve => setTimeout(resolve, 300));
      setProcessingProgress(75);


      setProcessingProgress(80);
      await new Promise(resolve => setTimeout(resolve, 400));
      setProcessingProgress(85);
      await new Promise(resolve => setTimeout(resolve, 300));
      setProcessingProgress(90);
      await new Promise(resolve => setTimeout(resolve, 200));
      setProcessingProgress(95);


      try {
        await updateRoomVideos(selectedRoom.id, [...selectedRoom.videos, ...cloudinaryUrls]);


        const updatedRooms = rooms.map(room =>
          room.id === selectedRoom.id
            ? { ...room, videos: [...room.videos, ...cloudinaryUrls] }
            : room
        );
        setRooms(updatedRooms);
        const updatedSelectedRoom = updatedRooms.find(room => room.id === selectedRoom.id);
        if (updatedSelectedRoom) {
          setSelectedRoom(updatedSelectedRoom);
          setCurrentRoomVideos(updatedSelectedRoom.videos);
        }
      } catch (error) {
        console.error('Error saving videos to Firebase:', error);
      }


      setRecordedVideos([]);
      setUploadedVideos([]);


      setProcessingProgress(100);
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsProcessing(false);
      setProcessingProgress(0);
      setCurrentOperation(null);
    }
  };

  const saveAfterAnalysis = async () => {
    if (selectedRoom) {
      setIsProcessing(true);
      setProcessingProgress(0);
      setCurrentOperation('save-only');

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


      const allVideos = [
        ...recordedVideos.map(v => ({ url: v.url, file: v.file, type: 'recorded' as const })),
        ...uploadedVideos.map(v => ({ url: v.url, file: v.file, type: 'uploaded' as const }))
      ];


      setProcessingProgress(10);
      const cloudinaryUrls: string[] = [];

      for (let i = 0; i < allVideos.length; i++) {
        const video = allVideos[i];
        if (video.file) {
          try {
            const cloudinaryUrl = await uploadToCloudinary(video.file);
            cloudinaryUrls.push(cloudinaryUrl);
            console.log(`Video ${i + 1} uploaded to Cloudinary:`, cloudinaryUrl);
          } catch (error) {
            console.error(`Failed to upload video ${i + 1} to Cloudinary:`, error);
            cloudinaryUrls.push(video.url);
          }
        } else {
          cloudinaryUrls.push(video.url);
        }

        const progress = 10 + ((i + 1) / allVideos.length) * 40;
        setProcessingProgress(Math.round(progress));
        await new Promise(resolve => setTimeout(resolve, 200));
      }


      setProcessingProgress(60);
      try {
        await updateRoomVideos(selectedRoom.id, [...selectedRoom.videos, ...cloudinaryUrls]);

        const updatedRooms = rooms.map(room =>
          room.id === selectedRoom.id
            ? { ...room, videos: [...room.videos, ...cloudinaryUrls] }
            : room
        );
        setRooms(updatedRooms);
        const updatedSelectedRoom = updatedRooms.find(room => room.id === selectedRoom.id);
        if (updatedSelectedRoom) {
          setSelectedRoom(updatedSelectedRoom);
          setCurrentRoomVideos(updatedSelectedRoom.videos);
        }
      } catch (error) {
        console.error('Error saving videos to Firebase:', error);
      }

      setProcessingProgress(90);


      setProcessingProgress(100);
      await new Promise(resolve => setTimeout(resolve, 1000));


      setRecordedVideos([]);
      setUploadedVideos([]);

      setIsProcessing(false);
      setProcessingProgress(0);
      setCurrentOperation(null);

      setToast({
        message: 'Videos saved successfully with AI analysis!',
        type: 'success'
      });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleRoomClick = async (room: Room) => {
    console.log('Opening room:', room);
    console.log('Room videos:', room.videos);

    setSelectedRoom(room);
    setCurrentRoomVideos(room.videos);
    setRecordedVideos([]);
    setUploadedVideos([]);


    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveRecording(false);

    try {
      const firebaseAnalyses = await getVideoAnalysesByRoomId(room.id);
      setFirebaseAnalyses(firebaseAnalyses);

      const firebaseResults: { [videoUrl: string]: { items: string[]; missingItems: string[] } } = {};

      firebaseAnalyses.forEach((analysis: VideoAnalysis) => {
        if (analysis.status === 'completed') {
          const keyUrl = analysis.cloudinaryUrl || analysis.videoUrl;
          firebaseResults[keyUrl] = {
            items: analysis.items,
            missingItems: analysis.missingItems
          };
        }
      });

      console.log('Processed Firebase results:', firebaseResults);

      const localStorageResults = loadAnalysisResults(room.id);
      console.log('LocalStorage results:', localStorageResults);

      const mergedResults = { ...localStorageResults, ...firebaseResults };
      console.log('Merged analysis results:', mergedResults);

      setVideoAnalysis(mergedResults);
      setShowAnalysisResults(Object.keys(mergedResults).length > 0);
    } catch (error) {
      console.error('Error loading analysis results:', error);

      const savedResults = loadAnalysisResults(room.id);
      setVideoAnalysis(savedResults);
      setShowAnalysisResults(Object.keys(savedResults).length > 0);
    }
  };

  const handleCreateRoom = async () => {
    if (newRoom.name.trim() && newRoom.description.trim() && homeId) {
      try {
        setCreatingRoom(true);
        console.log('Creating room with data:', { homeId, name: newRoom.name, description: newRoom.description });

        const roomIcons = ['🏠', '🍳', '🛋️', '🛏️', '🚿', '🍽️', '📚', '🏃‍♂️', '🎮', '🧘‍♀️', '🏋️‍♂️', '🎨', '🎵', '🌱', '🐕'];
        const randomIcon = roomIcons[Math.floor(Math.random() * roomIcons.length)];

        const roomData = {
          homeId,
          name: newRoom.name,
          icon: randomIcon,
          description: newRoom.description
        };

        console.log('Sending room data to Firebase:', roomData);
        const roomId = await createRoom(roomData);
        console.log('Room created successfully with ID:', roomId);

        const newRoomData: Room = {
          id: roomId,
          name: newRoom.name,
          icon: randomIcon,
          videos: [],
          description: newRoom.description,
          hasCompletedAnalysis: false
        };

        setRooms(prev => [...prev, newRoomData]);
        setNewRoom({ name: '', icon: '🏠', description: '' });
        setShowCreateRoom(false);


        setCreatedRoomData(newRoomData);
        setShowSuccessModal(true);
        setError(null);


        setTimeout(() => {
          setShowSuccessModal(false);
          setCreatedRoomData(null);
        }, 5000);
      } catch (error) {
        console.error('Error creating room:', error);
        setError(`Failed to create room: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setSuccess(null);
      } finally {
        setCreatingRoom(false);
      }
    } else {

      if (!newRoom.name.trim() || !newRoom.description.trim()) {
        setToast({
          message: 'Please fill in both room name and description!',
          type: 'error'
        });

        setTimeout(() => setToast(null), 4000);
      }
    }
  };

  const testFirebaseConnectionHandler = async () => {
    try {
      setTestingConnection(true);
      const isConnected = await testFirebaseConnection();
      if (isConnected) {
        setSuccess('Firebase connection successful!');
        setError(null);
      } else {
        setError('Firebase connection failed. Please check your configuration.');
        setSuccess(null);
      }
    } catch (error) {
      console.error('Firebase connection test error:', error);
      setError(`Firebase connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSuccess(null);
    } finally {
      setTestingConnection(false);
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

  const findAnalysisForVideo = (videoUrl: string) => {
    console.log('Finding analysis for video URL:', videoUrl);
    console.log('Current videoAnalysis state:', videoAnalysis);

    if (videoAnalysis[videoUrl]) {
      console.log('Found analysis in current session:', videoAnalysis[videoUrl]);
      return videoAnalysis[videoUrl];
    }

    if (videoUrl.includes('cloudinary.com')) {

      if (videoAnalysis[videoUrl]) {
        console.log('Found analysis for Cloudinary URL:', videoAnalysis[videoUrl]);
        return videoAnalysis[videoUrl];
      }
    }


    if (selectedRoom) {
      const savedResults = loadAnalysisResults(selectedRoom.id);
      console.log('Saved results from localStorage:', savedResults);


      if (savedResults[videoUrl]) {
        console.log('Found analysis in localStorage:', savedResults[videoUrl]);
        return savedResults[videoUrl];
      }


      if (videoUrl.includes('cloudinary.com')) {
        const analysisKeys = Object.keys(savedResults);
        console.log('Looking through analysis keys:', analysisKeys);
        for (const key of analysisKeys) {
          if (key.includes('cloudinary.com')) {
            console.log('Found matching Cloudinary analysis:', savedResults[key]);
            return savedResults[key];
          }
        }
      }
    }

    console.log('No analysis found for video URL:', videoUrl);
    return null;
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      setDeletingRoom(roomId);
      console.log('Deleting room:', roomId);

      await deleteRoom(roomId);


      setRooms(prev => prev.filter(room => room.id !== roomId));
      setShowDeleteConfirm(null);


      setError(null);
      setSuccess('Room deleted successfully!');

      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('Error deleting room:', error);
      setError(`Failed to delete room: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingRoom(null);
    }
  };

  const getAnalysisIdForVideo = (videoUrl: string) => {
    if (!selectedRoom) return null;
    if (!firebaseAnalyses) return null;
    const found = firebaseAnalyses.find((a: any) => (a.cloudinaryUrl || a.videoUrl) === videoUrl);
    return found ? found.id : null;
  };

  // Whenever setToast is called, set a timeout to clear it after 3 seconds
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [toast]);

  return (
    <div className="px-4 md:px-12 pb-20 md:pb-4">

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
        className="flex items-center gap-4 mb-8"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link to="/home">
          <Button variant="ghost" size="sm" className="flex items-center gap-2 cursor-pointer">
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
          🏠 {home ? home.name : 'Loading...'} - Rooms
        </motion.h1>
      </motion.div>

      <motion.div
        className="flex justify-end mb-6"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {rooms.length > 0 && (
          <div className="flex gap-3">
            <Button
              onClick={() => setShowCreateRoom(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl px-6 py-3 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Create Room
            </Button>
          </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 animate-pulse"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse"></div>
              </div>
            </motion.div>
          ))
        ) : rooms.length === 0 ? (
          <motion.div
            className="col-span-full flex flex-col items-center justify-center py-16 px-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-6xl mb-6">🏠</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
              No Rooms Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-8 max-w-md">
              Create your first room to start uploading videos and analyzing them with AI.
              Each room can contain multiple videos for comprehensive analysis.
            </p>
            <Button
              onClick={() => setShowCreateRoom(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl px-8 py-4 flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-300 text-lg hover:cursor-pointer"
            >
              <Plus className="w-6 h-6" />
              Create Your First Room
            </Button>
          </motion.div>
        ) : (
          rooms.map((room, i) => (
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

              {room.hasCompletedAnalysis && (
                <motion.div
                  className="absolute top-4 right-4 z-10"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="bg-green-500 text-white p-2 rounded-full shadow-lg">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </motion.div>
              )}


              {!room.hasCompletedAnalysis && (
                <motion.div
                  className="absolute top-4 right-4 z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(room.id);
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 p-2 rounded-full cursor-pointer"
                    disabled={deletingRoom === room.id}
                    title="Delete Room"
                  >
                    {deletingRoom === room.id ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </motion.div>
              )}

              <div className="p-6">
                <div className="text-4xl mb-4">{room.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {room.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {room.description}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Video className="w-4 h-4" />
                    <span>{room.videos.length} videos</span>
                  </div>
                  {room.hasCompletedAnalysis && (
                    <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>Analyzed</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {selectedRoom && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setSelectedRoom(null);

            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }
            setIsLiveRecording(false);
          }}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >

            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-t-2xl p-6 border-b border-gray-200 dark:border-gray-700 shadow-sm">
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedRoom(null);

                      if (videoRef.current) {
                        videoRef.current.srcObject = null;
                      }
                      setIsLiveRecording(false);
                    }}
                    className="text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </div>


            <div className="flex-1 overflow-y-auto p-6">

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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Room Videos ({currentRoomVideos.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentRoomVideos.map((videoUrl, index) => {
                      const analysis = findAnalysisForVideo(videoUrl);
                      return (
                        <div key={index} className="relative group">
                          <video
                            src={videoUrl}
                            controls
                            className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"
                          />
                          <div className="absolute top-2 right-2 flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer"
                              onClick={() => setVideoToDelete(videoUrl)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {analysis && showAnalysisResults && (
                            <motion.div
                              className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5 }}
                            >
                              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                                🤖 AI Analysis Results
                              </h4>
                              <div className="mb-3">
                                <h5 className="text-xs font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                                  ✅ Detected Items ({analysis.items.length})
                                </h5>
                                <div className="flex flex-wrap gap-1">
                                  {(analysis.items || []).map((item: string, itemIndex: number) => (
                                    <span
                                      key={itemIndex}
                                      className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-white text-xs rounded-full"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {recordedVideos.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    New Recorded Videos ({recordedVideos.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recordedVideos.map((video, index) => {
                      const analysis = findAnalysisForVideo(video.url);

                      return (
                        <div key={index} className="relative group">
                          <video
                            src={video.url}
                            controls
                            className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"
                          />


                          {analyzingVideos.has(video.url) && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center">
                              <div className="text-center">
                                <motion.div
                                  className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3"
                                  animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 360]
                                  }}
                                  transition={{
                                    scale: { duration: 1, repeat: Infinity },
                                    rotate: { duration: 2, repeat: Infinity, ease: "linear" }
                                  }}
                                >
                                  <Video className="w-6 h-6 text-white" />
                                </motion.div>
                                <div className="text-white font-semibold text-sm">Analyzing...</div>
                                <div className="text-white/80 text-xs">AI is processing this video</div>
                              </div>
                            </div>
                          )}

                          <div className="absolute top-2 right-2 flex gap-2">
                            {analyzingVideos.has(video.url) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer"
                                onClick={() => removeVideo(index, 'recorded')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : (
                              <></>
                            )}
                          </div>

                          {analysis && showAnalysisResults && (
                            <motion.div
                              className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5 }}
                            >
                              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                                🤖 AI Analysis Results
                              </h4>

                              <div className="mb-3">
                                <h5 className="text-xs font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                                  ✅ Detected Items ({analysis.items.length})
                                </h5>
                                <div className="flex flex-wrap gap-1">
                                  {(analysis.items || []).map((item: string, itemIndex: number) => (
                                    <span
                                      key={itemIndex}
                                      className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded-full"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {uploadedVideos.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    New Uploaded Videos ({uploadedVideos.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uploadedVideos.map((video, index) => {
                      const analysis = findAnalysisForVideo(video.url);

                      return (
                        <div key={index} className="relative group">
                          <video
                            src={video.url}
                            controls
                            className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"
                          />

                          {analyzingVideos.has(video.url) && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center">
                              <div className="text-center">
                                <motion.div
                                  className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3"
                                  animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 360]
                                  }}
                                  transition={{
                                    scale: { duration: 1, repeat: Infinity },
                                    rotate: { duration: 2, repeat: Infinity, ease: "linear" }
                                  }}
                                >
                                  <Video className="w-6 h-6 text-white" />
                                </motion.div>
                                <div className="text-white font-semibold text-sm">Analyzing...</div>
                                <div className="text-white/80 text-xs">AI is processing this video</div>
                              </div>
                            </div>
                          )}

                          <div className="absolute top-2 right-2 flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer"
                              onClick={() => removeVideo(index, 'uploaded')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {analysis && showAnalysisResults && (
                            <motion.div
                              className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5 }}
                            >
                              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                                🤖 AI Analysis Results
                              </h4>
                              <div className="mb-3">
                                <h5 className="text-xs font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                                  ✅ Detected Items ({analysis.items.length})
                                </h5>
                                <div className="flex flex-wrap gap-1">
                                  {(analysis.items || []).map((item: string, itemIndex: number) => (
                                    <span
                                      key={itemIndex}
                                      className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded-full"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(recordedVideos.length > 0 || uploadedVideos.length > 0) && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  {isProcessing ? (
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
                            animate={{ width: `${processingProgress}%` }}
                            transition={{
                              duration: 0.5,
                              ease: "easeInOut"
                            }}
                          />
                        </div>
                        <motion.div
                          className="text-white font-semibold"
                          animate={{ opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          {currentOperation === 'save-analyze' ? 'Saving and analyzing videos...' : 'Saving videos...'}
                        </motion.div>
                        <motion.div
                          className="text-white/80 text-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1 }}
                        >
                          {currentOperation === 'save-analyze'
                            ? '✨ Processing videos and detecting items'
                            : '💾 Saving videos to your room'
                          }
                        </motion.div>
                      </motion.div>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={saveVideosToRoom}
                        className="flex-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-semibold flex items-center justify-center gap-3 py-4 text-lg transition-all duration-500 hover:scale-[1.01] hover:cursor-pointer shadow-xl hover:shadow-blue-500/20 rounded-2xl border border-white/20 backdrop-blur-sm relative overflow-hidden group"
                        disabled={isProcessing}
                      >

                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/15 to-transparent" />


                        <motion.div
                          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/10 to-purple-400/10"
                          animate={{
                            opacity: [0.3, 0.6, 0.3]
                          }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />

                        <motion.div
                          className="relative z-10"
                          whileHover={{
                            scale: 1.1,
                            transition: { duration: 0.3 }
                          }}
                        >
                          <Save className="w-5 h-5" />
                        </motion.div>

                        <span className="relative z-10 font-semibold text-lg">
                          Save & Analyze
                        </span>

                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )
      }

      {
        showCreateRoom && (
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
                      disabled={creatingRoom}
                      className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateRoom}
                      disabled={!newRoom.name.trim() || !newRoom.description.trim() || creatingRoom}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold flex items-center gap-2 hover:cursor-pointer"
                    >
                      {creatingRoom ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full hover:cursor-pointer"
                          />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 hover:cursor-pointer" />
                          Create Room
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )
      }

      {
        showSuccessModal && createdRoomData && (
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
                  Room Created Successfully!
                </motion.h2>


                <motion.div
                  className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="text-4xl mb-3">{createdRoomData.icon}</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {createdRoomData.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {createdRoomData.description}
                  </p>
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
                      handleRoomClick(createdRoomData);
                    }}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Open Room
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
        )
      }

      {
        showDeleteConfirm && (
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
                  Delete Room?
                </motion.h2>

                <motion.p
                  className="text-gray-600 dark:text-gray-400 mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  This will permanently delete the room and all its videos and analysis data. This action cannot be undone.
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
                    disabled={deletingRoom === showDeleteConfirm}
                    className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDeleteRoom(showDeleteConfirm!)}
                    disabled={deletingRoom === showDeleteConfirm}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    {deletingRoom === showDeleteConfirm ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full cursor-pointer"
                        />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Room
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )
      }

      <Dialog open={!!videoToDelete} onOpenChange={open => { if (!open) setVideoToDelete(null); }}>
        <DialogContent>
          <DialogTitle>Delete Video?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this video? This will remove it from the room and delete its analysis data. This action cannot be undone.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoToDelete(null)} disabled={deletingVideo}>Cancel</Button>
            <Button
              className="cursor-pointer"
              variant="destructive"
              onClick={async () => {
                if (!videoToDelete || !selectedRoom) return;
                setDeletingVideo(true);
                try {
                  // Remove from UI
                  setCurrentRoomVideos(prev => prev.filter(url => url !== videoToDelete));
                  setVideoAnalysis(prev => {
                    const newAnalysis = { ...prev };
                    delete newAnalysis[videoToDelete];
                    return newAnalysis;
                  });
                  // Remove from Firebase
                  const newVideos = currentRoomVideos.filter(url => url !== videoToDelete);
                  await updateRoomVideos(selectedRoom.id, newVideos);
                  // Delete analysis in Firebase
                  const analysisId = getAnalysisIdForVideo(videoToDelete);
                  if (analysisId) {
                    await deleteVideoAnalysis(analysisId);
                  }
                  setVideoToDelete(null);
                  setToast({ message: 'Video deleted successfully.', type: 'success' });
                  // Update hasCompletedAnalysis and videos for the room
                  try {
                    const completedAnalyses = await getCompletedAnalysesByRoomId(selectedRoom.id);
                    const completedVideoUrls = completedAnalyses.map(a => a.cloudinaryUrl || a.videoUrl);
                    const hasCompletedAnalysis = newVideos.length > 0 && newVideos.every(url => completedVideoUrls.includes(url));
                    setRooms(prevRooms => prevRooms.map(room =>
                      room.id === selectedRoom.id
                        ? { ...room, hasCompletedAnalysis, videos: newVideos }
                        : room
                    ));
                    // Notify home page to update analysis status
                    window.dispatchEvent(new CustomEvent('home-analysis-status-updated', { detail: { homeId: homeId || (home && home.id) } }));
                  } catch (err) {
                    console.error('Error updating room analysis status:', err);
                  }
                } catch (err) {
                  setToast({ message: 'Failed to delete video.', type: 'error' });
                } finally {
                  setDeletingVideo(false);
                }
              }}
              disabled={deletingVideo}
            >
              {deletingVideo ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}; 