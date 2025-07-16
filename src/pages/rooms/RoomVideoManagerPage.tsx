import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Video,
  Upload,
  Square,
  Trash2,
  Camera,
  PlayCircle,
  Pause,
  Play,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  ArrowLeft,
  CheckCircle
} from 'lucide-react';
import {
  getHomeById,
  getRoomsByHomeId,
  updateRoomVideos,
  createVideoAnalysis,
  updateVideoAnalysisResults,
  getCompletedAnalysesByRoomId,
  createBatchVideoAnalysis,
  getBatchAnalysesByRoomId
} from '../../lib/firebaseService';
import type { VideoAnalysis } from '../../lib/firebaseService';
import { extractFramesFromVideo } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns'; // Make sure 'date-fns' is installed: npm install date-fns

interface Home {
  id: string;
  name: string;
  address: string;
  imageUrl?: string;
}

interface Room {
  id: string;
  name: string;
  icon: string;
  videos: string[];
  description: string;
}

interface VideoItem {
  url: string;
  file?: File;
}

interface VideoAnalysisResult {
  items: string[];
  missingItems: string[];
}

interface Toast {
  message: string;
  type: 'info' | 'success' | 'error';
}

const RoomVideoManagerPage = () => {
  const { homeId, roomId } = useParams<{ homeId: string; roomId: string }>();
  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recordedVideos, setRecordedVideos] = useState<VideoItem[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<VideoItem[]>([]);
  const [isLiveRecording, setIsLiveRecording] = useState<boolean>(false);
  const [isStartingRecording, setIsStartingRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [videoAnalysis, setVideoAnalysis] = useState<Record<string, VideoAnalysisResult>>({});
  const [analyzingVideos, setAnalyzingVideos] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<{ [url: string]: number }>({});
  const [selectedVideoForAnalysis, setSelectedVideoForAnalysis] = useState<string | null>(null);
  const [selectedModalVideo, setSelectedModalVideo] = useState<string | null>(null);
  const [selectedModalVideoAnalysis, setSelectedModalVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savingToRoom, setSavingToRoom] = useState<Record<string, boolean>>({});
  const [roomAnalyses, setRoomAnalyses] = useState<Record<string, VideoAnalysis | null>>({});
  const [videoCloudinaryUrls, setVideoCloudinaryUrls] = useState<Record<string, string>>({});
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [batchAnalysisResult, setBatchAnalysisResult] = useState<string[]>([]);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchAnalyses, setBatchAnalyses] = useState<any[]>([]);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [savedVideosCount, setSavedVideosCount] = useState(0);
  const [leftSectionHeight, setLeftSectionHeight] = useState<number>(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [showVideoControls, setShowVideoControls] = useState<boolean>(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const newVideosRef = useRef<HTMLDivElement>(null);
  const [batchProgress, setBatchProgress] = useState(0);

  const combinedAnalysisResult = useMemo(() => {
    const allItems = Object.values(videoAnalysis)
      .flatMap(result => result.items || []);
    return Array.from(new Set(allItems));
  }, [videoAnalysis]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!homeId || !roomId) throw new Error('Missing home or room ID');
        const homeData = await getHomeById(homeId);
        setHome(homeData);
        const rooms = await getRoomsByHomeId(homeId);
        const foundRoom = rooms.find((r: Room) => String(r.id) === String(roomId));
        if (!foundRoom) throw new Error('Room not found');
        setRoom(foundRoom);
      } catch (err: any) {
        setError(err.message || 'Failed to load home or room data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [homeId, roomId]);

  useEffect(() => {
    async function fetchAnalyses() {
      if (!room || !room.id || !room.videos) return;
      try {
        const analyses = await getCompletedAnalysesByRoomId(room.id);
        const map: Record<string, VideoAnalysis | null> = {};
        room.videos.forEach(url => {
          map[url] = analyses.find(a => a.cloudinaryUrl === url || a.videoUrl === url) || null;
        });
        setRoomAnalyses(map);
      } catch { }
    }
    fetchAnalyses();
  }, [room && room.id, room && room.videos && room.videos.join(",")]);

  useEffect(() => {
    async function fetchBatchAnalyses() {
      if (!room || !room.id) return;
      try {
        const batches = await getBatchAnalysesByRoomId(room.id);
        setBatchAnalyses(batches);
      } catch { }
    }
    fetchBatchAnalyses();
  }, [room && room.id]);

  useEffect(() => {
    if ((recordedVideos.length > 0 || uploadedVideos.length > 0) && newVideosRef.current) {
      newVideosRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [recordedVideos.length, uploadedVideos.length]);

  const startLiveRecording = async () => {
    setIsStartingRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
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
    } catch (err) {
      setIsStartingRecording(false);
      setError('Failed to start camera.');
    }
  };

  const stopLiveRecording = () => {
    if (mediaRecorderRef.current && isLiveRecording) {
      mediaRecorderRef.current.stop();
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsPaused(false);
    }
  };

  const pauseLiveRecording = () => {
    if (mediaRecorderRef.current && isLiveRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeLiveRecording = () => {
    if (mediaRecorderRef.current && isLiveRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const toggleVideoPlay = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const toggleVideoMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isVideoMuted;
      setIsVideoMuted(!isVideoMuted);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setVideoCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setVideoCurrentTime(time);
    }
  };

  const skipVideo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
      setVideoCurrentTime(videoRef.current.currentTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playVideo = (videoUrl: string) => {
    setPlayingVideo(videoUrl);
    // Play the video immediately using the ref
    const videoElement = videoRefs.current[videoUrl];
    if (videoElement) {
      videoElement.play().catch(err => console.log('Auto-play prevented:', err));
    }
  };

  const stopVideo = () => {
    setPlayingVideo(null);
  };

  // Function to measure and update left section height
  const updateLeftSectionHeight = () => {
    const leftSection = document.querySelector('.left-section') as HTMLElement;
    if (leftSection) {
      const height = leftSection.offsetHeight;
      setLeftSectionHeight(height);
    }
  };

  // Update height when content changes
  useEffect(() => {
    const updateHeight = () => {
      setTimeout(() => {
        updateLeftSectionHeight();
      }, 50);
    };

    updateHeight();

    // Create a ResizeObserver to watch for content changes
    const leftSection = document.querySelector('.left-section') as HTMLElement;
    if (leftSection) {
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(leftSection);

      return () => resizeObserver.disconnect();
    }
  }, [recordedVideos, uploadedVideos, videoAnalysis, batchAnalysisResult, room]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const videoUrl = URL.createObjectURL(file);
      setUploadedVideos(prev => [...prev, { url: videoUrl, file }]);
    }
  };

  // Save & Analyze logic
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default');
    formData.append('cloud_name', import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name');
    const resourceType = file.type.startsWith('image/') ? 'image' : 'video';
    const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name'}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload to Cloudinary');
    const data = await response.json();
    return data.secure_url;
  };

  // 2. In analyzeVideoWithAI, upload the video to Cloudinary in parallel with frame extraction
  const analyzeVideoWithAI = async (videoUrl: string, videoIndex: number, videoFile?: File, cloudinaryUrl?: string) => {
    setAnalyzingVideos(prev => new Set(prev).add(videoUrl));
    setVideoProgress(prev => ({ ...prev, [videoUrl]: 5 }));
    try {
      let frameImageUrls: string[] = [];
      let mainCloudinaryUrl = cloudinaryUrl || videoCloudinaryUrls[videoUrl];
      // Always await Cloudinary upload for the main video file
      if (videoFile && !mainCloudinaryUrl) {
        mainCloudinaryUrl = await uploadToCloudinary(videoFile);
        setVideoCloudinaryUrls(prev => ({ ...prev, [videoUrl]: mainCloudinaryUrl! }));
      }
      if (videoFile) {
        setVideoProgress(prev => ({ ...prev, [videoUrl]: 20 }));
        const frames = await extractFramesFromVideo(videoFile, 2);
        for (let i = 0; i < frames.length; i++) {
          const frameFile = new File([frames[i]], `frame_${i}.jpg`, { type: 'image/jpeg' });
          const url = await uploadToCloudinary(frameFile);
          frameImageUrls.push(url);
          setVideoProgress(prev => ({ ...prev, [videoUrl]: 30 + i * 10 }));
        }
      } else {
        frameImageUrls = [mainCloudinaryUrl || videoUrl];
        setVideoProgress(prev => ({ ...prev, [videoUrl]: 30 }));
      }
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) throw new Error('OpenAI API key is missing.');
      setVideoProgress(prev => ({ ...prev, [videoUrl]: 60 }));
      await new Promise(res => setTimeout(res, 1000));
      setVideoProgress(prev => ({ ...prev, [videoUrl]: 90 }));
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
              content: `You are an expert at analyzing video content and identifying objects, items, and elements present in videos.

Your task is to carefully examine the provided video frames and create a comprehensive, detailed list of ALL visible items, objects, furniture, appliances, decorations, and any other notable elements you can identify.

IMPORTANT GUIDELINES:
- Be thorough and comprehensive - list everything you can see
- Include furniture (chairs, tables, beds, sofas, etc.)
- Include appliances (refrigerators, microwaves, TVs, computers, etc.)
- Include decorations (paintings, plants, rugs, curtains, etc.)
- Include electronics and devices
- Include lighting fixtures and lamps
- Include storage items (shelves, cabinets, drawers, etc.)
- Include any visible architectural features
- Be specific about item types and materials when visible
- Mention colors and patterns if they help identify items
- Focus on items relevant for home/room analysis

Format your response as a clean list with each item on a separate line:
- Specific item name with details
- Another item with details
- Continue listing all visible items

Provide ONLY the item names and descriptions. Do not include explanations or commentary.`,
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
        // Filter out meta/instructional lines and markdown headings
        const lower = line.toLowerCase();
        if (
          lower.includes('here is a list of') ||
          lower.includes('visible in the frames') ||
          lower.includes('visible in the video') ||
          lower.includes('the following items') ||
          lower.includes('elements present') ||
          lower.includes('as follows:') ||
          lower.startsWith('items:') ||
          lower.startsWith('elements:') ||
          lower.includes('based on the video frames') ||
          lower.includes('relevant for a home or room analysis') ||
          line.trim().match(/^#+\s/) // markdown headings like #, ##, ###, ####
        ) {
          return;
        }
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
      const analysisData: VideoAnalysisResult = { items, missingItems: [] };
      setVideoAnalysis(prev => ({ ...prev, [videoUrl]: analysisData }));
      setVideoProgress(prev => ({ ...prev, [videoUrl]: 100 }));
      setTimeout(() => setVideoProgress(prev => { const { [videoUrl]: _, ...rest } = prev; return rest; }), 1000);
      if (room) {
        if (mainCloudinaryUrl) {
          const firebaseAnalysisId = await createVideoAnalysis(room.id, videoUrl, mainCloudinaryUrl);
          await updateVideoAnalysisResults(firebaseAnalysisId, analysisData.items, [], mainCloudinaryUrl);
        } else {
          const firebaseAnalysisId = await createVideoAnalysis(room.id, videoUrl);
          await updateVideoAnalysisResults(firebaseAnalysisId, analysisData.items, []);
        }
      }
    } catch (err) {
      setError('Failed to analyze video.');
      setVideoProgress(prev => ({ ...prev, [videoUrl]: 0 }));
    } finally {
      setAnalyzingVideos(prev => { const s = new Set(prev); s.delete(videoUrl); return s; });
    }
  };

  // 3. In the save-all logic, use the Cloudinary URL from state
  const saveVideosToRoom = async () => {
    if (!room) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    try {
      const allVideos: VideoItem[] = [
        ...recordedVideos,
        ...uploadedVideos
      ];
      // Wait for all Cloudinary uploads to finish
      await Promise.all(allVideos.map(async (video) => {
        while (!videoCloudinaryUrls[video.url]) {
          await new Promise(res => setTimeout(res, 200));
        }
      }));
      const cloudinaryUrls: string[] = allVideos.map(video => videoCloudinaryUrls[video.url]);
      await updateRoomVideos(room.id, [...(room.videos || []), ...cloudinaryUrls]);
      setRoom(prev => prev ? { ...prev, videos: [...(prev.videos || []), ...cloudinaryUrls] } : null);
      setRecordedVideos([]);
      setUploadedVideos([]);
      setSavedVideosCount(allVideos.length);
      setShowSaveSuccessModal(true);
      setSuccess('Videos saved successfully!');
    } catch (err) {
      setError('Failed to save videos.');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Batch analysis function
  const analyzeAllVideosAsBatch = async () => {
    setIsBatchAnalyzing(true);
    setBatchProgress(0);
    try {
      // Gather all new videos
      const allVideos = [...recordedVideos, ...uploadedVideos];

      // Upload all videos to Cloudinary
      setBatchProgress(10);
      await Promise.all(allVideos.map(async (video) => {
        if (video.file && !videoCloudinaryUrls[video.url]) {
          try {
            const cloudinaryUrl = await uploadToCloudinary(video.file);
            setVideoCloudinaryUrls(prev => ({ ...prev, [video.url]: cloudinaryUrl }));
          } catch (err) {
            throw err;
          }
        }
      }));
      setBatchProgress(30);

      // Extract frames from each video
      let allFrames: File[] = [];
      for (const video of allVideos) {
        if (video.file) {
          const frames = await extractFramesFromVideo(video.file, 2); // 2 frames per video (adjust as needed)
          frames.forEach((frame, i) => {
            allFrames.push(new File([frame], `frame_${video.url}_${i}.jpg`, { type: 'image/jpeg' }));
          });
        }
      }
      setBatchProgress(50);

      // Upload all frames to Cloudinary
      const frameImageUrls: string[] = [];
      for (let i = 0; i < allFrames.length; i++) {
        const frameFile = allFrames[i];
        const url = await uploadToCloudinary(frameFile);
        frameImageUrls.push(url);
        setBatchProgress(50 + Math.round((i + 1) / allFrames.length * 20)); // 50-70%
      }

      // Prepare OpenAI Vision API call
      setBatchProgress(80);
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) throw new Error('OpenAI API key is missing.');
      const openaiContent = [
        {
          type: 'text',
          text: 'Please analyze these video frames (from multiple videos) and list all the items, furniture, appliances, and objects you can see. Focus on items that would be relevant for a home or room analysis.'
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
              content: `You are an expert at analyzing video content and identifying objects, items, and elements present in videos.\n\nYour task is to watch the provided video frames (from multiple videos) and create a comprehensive list of all visible items, objects, furniture, appliances, decorations, and any other notable elements you can identify.\n\nPlease provide your response in the following format:\n- List each item on a separate line\n- Be specific and descriptive\n- Include furniture, electronics, decorations, appliances, etc.\n- Mention the approximate location or context if relevant\n- Focus on items that would be important for real estate or home analysis\n\nFormat your response as a clean list with each item clearly described.`,
            },
            {
              role: "user",
              content: openaiContent,
            },
          ],
          max_tokens: 1000,
        }),
      });
      setBatchProgress(90);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      const analysisResult = data.choices?.[0]?.message?.content || "No items detected in the videos.";
      const lines = analysisResult.split('\n').filter((line: string) => line.trim());
      const items: string[] = [];
      lines.forEach((line: string) => {
        // Filter out meta/instructional lines and markdown headings
        const lower = line.toLowerCase();
        if (
          lower.includes('here is a list of') ||
          lower.includes('visible in the frames') ||
          lower.includes('visible in the video') ||
          lower.includes('the following items') ||
          lower.includes('elements present') ||
          lower.includes('as follows:') ||
          lower.startsWith('items:') ||
          lower.startsWith('elements:') ||
          lower.includes('based on the video frames') ||
          lower.includes('relevant for a home or room analysis') ||
          line.trim().match(/^#+\s/)
        ) {
          return;
        }
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
      setBatchAnalysisResult(items);
      setBatchProgress(100);
    } catch (err) {
      setBatchAnalysisResult(["Failed to analyze videos as a batch."]);
      setBatchProgress(0);
    } finally {
      setIsBatchAnalyzing(false);
    }
  };

  // 2. Add saveBatchToRoom function
  const saveBatchToRoom = async () => {
    console.log(room, "room data");

    if (!room) {
      setError('Room not loaded!');
      return;
    }
    setIsProcessing(true);
    try {
      // Upload all new videos to Cloudinary if not already
      const allVideos = [...recordedVideos, ...uploadedVideos];
      await Promise.all(allVideos.map(async (video) => {
        let waited = 0;
        while (!videoCloudinaryUrls[video.url]) {
          await new Promise(res => setTimeout(res, 200));
          waited += 200;
          if (waited > 20000) throw new Error('Cloudinary upload timeout');
        }
      }));
      const cloudinaryUrls = allVideos.map(video => videoCloudinaryUrls[video.url]);
      const batchEntry = {
        videoUrls: cloudinaryUrls,
        items: batchAnalysisResult,
        type: 'batch',
        createdAt: new Date(),
      };
      await createBatchVideoAnalysis(room.id, batchEntry);
      const batchKey = `batch:${Date.now()}`;
      await updateRoomVideos(room.id, [...(room.videos || []), batchKey]);
      setRoom(prev => prev ? { ...prev, videos: [...(prev.videos || []), batchKey] } : null);

      try {
        const updatedBatches = await getBatchAnalysesByRoomId(room.id);
        setBatchAnalyses(updatedBatches);
      } catch (err) {
        console.error('Failed to refresh batch analyses:', err);
      }

      setRecordedVideos([]);
      setUploadedVideos([]);
      setBatchAnalysisResult([]);
      setSavedVideosCount(allVideos.length);
      setShowSaveSuccessModal(true);
      setSuccess('Batch videos and AI results saved!');
      setShowSuccessModal(true);
    } catch (err) {
      setError('Failed to save batch analysis to Firebase.');
      console.error('Save batch error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Automatically analyze new videos when added
  // Remove any useEffect that auto-analyzes videos after upload/record

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!room) return <div className="p-8 text-red-500">Room not found.</div>;

  // Remove the fullscreen loader and bg blur overlay (do not render isAnyAnalyzing loader)
  // Only show per-video loader below the video being analyzed in the left column

  return (
    <>
      {/* Header with back button */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to={`/homes/${homeId}`}>
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              Back to Rooms
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl flex items-center justify-center text-xl">
              {room?.icon}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{room?.name}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">{room?.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-0 items-start">
        {/* Left: Record/Upload Section */}
        <div className="left-section w-full md:w-3/4 p-2 md:p-4 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Record or Upload Video</h2>
          {/* Live Recording Section */}
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Live Recording
            </h3>
            <div className="bg-gradient-to-br from-blue-100/60 via-white/80 to-purple-100/60 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-md p-4 md:p-6 mb-2 border border-blue-200 dark:border-blue-700 shadow-md relative overflow-hidden">
              <div className="relative flex flex-col items-center">
                <div className={`w-full h-72 md:h-80 lg:h-96 rounded-2xl mb-3 shadow-inner border-4 transition-all duration-300 relative overflow-hidden ${isLiveRecording ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-full object-cover rounded-2xl"
                    onTimeUpdate={handleVideoTimeUpdate}
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                    onMouseEnter={() => setShowVideoControls(true)}
                    onMouseLeave={() => setShowVideoControls(false)}
                  />

                  {/* Live Recording Indicator */}
                  {isLiveRecording && (
                    <span className={`absolute top-3 left-3 flex items-center gap-2 px-3 py-1 text-white text-xs font-bold rounded-full shadow-lg z-20 ${isPaused ? 'bg-yellow-600' : 'bg-red-600 animate-pulse'}`}>
                      <span className={`w-2 h-2 bg-white rounded-full ${isPaused ? '' : 'animate-ping'}`} />
                      {isPaused ? 'PAUSED' : 'LIVE'}
                    </span>
                  )}

                  {/* Custom Video Controls Overlay */}
                  {!isLiveRecording && (
                    <div
                      className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${showVideoControls ? 'opacity-100' : 'opacity-0'}`}
                      onMouseEnter={() => setShowVideoControls(true)}
                      onMouseLeave={() => setShowVideoControls(false)}
                    >
                      {/* Center Play/Pause Button */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          onClick={toggleVideoPlay}
                          className="bg-white/20 backdrop-blur-sm rounded-full p-4 hover:bg-white/30 transition-all duration-200 hover:scale-110"
                        >
                          {isVideoPlaying ? (
                            <Pause className="w-8 h-8 text-white" />
                          ) : (
                            <Play className="w-8 h-8 text-white ml-1" />
                          )}
                        </button>
                      </div>

                      {/* Bottom Controls Bar */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        {/* Progress Bar */}
                        <div className="mb-3">
                          <input
                            type="range"
                            min="0"
                            max={videoDuration || 0}
                            value={videoCurrentTime}
                            onChange={handleVideoSeek}
                            className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(videoCurrentTime / (videoDuration || 1)) * 100}%, rgba(255,255,255,0.3) ${(videoCurrentTime / (videoDuration || 1)) * 100}%, rgba(255,255,255,0.3) 100%)`
                            }}
                          />
                        </div>

                        {/* Control Buttons */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={toggleVideoPlay}
                              className="text-white hover:text-blue-300 transition-colors"
                            >
                              {isVideoPlaying ? (
                                <Pause className="w-5 h-5" />
                              ) : (
                                <Play className="w-5 h-5" />
                              )}
                            </button>

                            <button
                              onClick={() => skipVideo(-10)}
                              className="text-white hover:text-blue-300 transition-colors"
                            >
                              <SkipBack className="w-5 h-5" />
                            </button>

                            <button
                              onClick={() => skipVideo(10)}
                              className="text-white hover:text-blue-300 transition-colors"
                            >
                              <SkipForward className="w-5 h-5" />
                            </button>

                            <button
                              onClick={toggleVideoMute}
                              className="text-white hover:text-blue-300 transition-colors"
                            >
                              {isVideoMuted ? (
                                <VolumeX className="w-5 h-5" />
                              ) : (
                                <Volume2 className="w-5 h-5" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-white text-sm">
                            <span>{formatTime(videoCurrentTime)}</span>
                            <span>/</span>
                            <span>{formatTime(videoDuration)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {!isLiveRecording && !videoRef.current?.srcObject && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      className="flex flex-col items-center justify-center focus:outline-none group bg-white/90 dark:bg-gray-800/90 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-all duration-300 hover:scale-105"
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={startLiveRecording}
                      disabled={isStartingRecording}
                    >
                      <motion.div
                        className="bg-blue-100 dark:bg-blue-900 rounded-full p-5 mb-2 flex items-center justify-center shadow group-hover:shadow-lg transition"
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Camera className="w-12 h-12 text-blue-600 dark:text-blue-200 drop-shadow-lg" />
                      </motion.div>
                      <span className="text-base font-semibold text-blue-700 dark:text-blue-200 mt-1 opacity-90 group-hover:text-blue-900 dark:group-hover:text-white transition">Click to start camera</span>
                      {isStartingRecording && (
                        <div className="flex flex-col items-center mt-3">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-700 dark:border-t-blue-200 rounded-full mb-1" />
                          <span className="text-xs text-blue-600 dark:text-blue-200">Initializing Camera...</span>
                        </div>
                      )}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                {isLiveRecording ? (
                  <>
                    {!isPaused ? (
                      <Button onClick={pauseLiveRecording} className="bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:cursor-pointer">
                        <Pause className="w-5 h-5" />
                        Pause Recording
                      </Button>
                    ) : (
                      <Button onClick={resumeLiveRecording} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:cursor-pointer">
                        <Play className="w-5 h-5" />
                        Resume Recording
                      </Button>
                    )}
                    <Button onClick={stopLiveRecording} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:cursor-pointer animate-pulse">
                      <Square className="w-5 h-5" />
                      Stop Recording
                    </Button>
                  </>
                ) : (
                  <></>
                )}
              </div>
              <div className="mt-4 p-3 bg-blue-50/80 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400 dark:text-blue-200" />
                <span className="text-blue-700 dark:text-blue-300 text-xs">💡 <strong>Tip:</strong> Good lighting and a stable camera help quality.</span>
              </div>
            </div>
          </div>
          {/* Upload Video Option */}
          <div className="mb-4 w-full">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2 w-full">
              <Upload className="w-5 h-5" />
              <span className="flex-1">Upload Video</span>
            </h3>
            <div
              className="w-full flex flex-col gap-2"
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
                }
              }}
            >
              <label
                htmlFor="video-upload-input"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dotted border-blue-400 dark:border-blue-600 rounded-xl cursor-pointer bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all duration-200 p-6 text-center gap-3"
                style={{ minHeight: '10rem' }}
              >
                <Upload className="w-10 h-10 text-blue-500 mb-2" />
                <span className="text-base font-semibold text-blue-700 dark:text-blue-200">Click or drag video file here to upload</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">MP4, WebM, or MOV (max 100MB)</span>
                <input
                  id="video-upload-input"
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          {/* New Videos Section: reduce margin */}
          {(recordedVideos.length > 0 || uploadedVideos.length > 0) && (
            <div ref={newVideosRef} className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">New Videos</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...recordedVideos, ...uploadedVideos].map((video, index) => (
                  <div key={index} className="relative group mb-6 w-full">
                    {/* Delete button for new video */}
                    <button
                      className="absolute top-2 right-2 p-2 rounded-md bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-800 shadow transition z-20"
                      title="Delete video"
                      onClick={e => {
                        e.stopPropagation();
                        setRecordedVideos(prev => prev.filter(v => v.url !== video.url));
                        setUploadedVideos(prev => prev.filter(v => v.url !== video.url));
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="relative w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden group">
                      <video
                        ref={(el) => { videoRefs.current[video.url] = el; }}
                        src={video.url}
                        className="w-full h-full object-cover"
                        controls={playingVideo === video.url}
                        onTimeUpdate={(e) => {
                          const target = e.target as HTMLVideoElement;
                          if (target.currentTime > 0) {
                            target.style.opacity = '1';
                          }
                        }}
                        onEnded={() => stopVideo()}
                      />
                      {playingVideo !== video.url && (
                        <div
                          className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center cursor-pointer"
                          onClick={() => playVideo(video.url)}
                        >
                          <PlayCircle className="w-8 h-8 text-white/80 drop-shadow-lg" />
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{video.file?.name || `Video ${index + 1}`}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{video.file ? new Date(video.file.lastModified).toLocaleString() : ''}</span>
                    </div>
                    {/* Loader and AI results for new videos */}
                    {/* Per-video loader (unchanged) */}
                    {analyzingVideos.has(video.url) && (
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg" />
                        <motion.div className="relative flex flex-col items-center gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                          <div className="flex gap-2">
                            {[...Array(3)].map((_, i) => (
                              <motion.div key={i} className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center" animate={{ y: [0, -10, 0], scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}>
                                <Video className="w-4 h-4 text-blue-600 dark:text-white" />
                              </motion.div>
                            ))}
                          </div>
                          <div className="w-48 bg-white/20 rounded-full h-2 overflow-hidden">
                            <motion.div className="h-full bg-blue-500 rounded-full" initial={{ width: '0%' }} animate={{ width: `${videoProgress[video.url] || 0}%` }} transition={{ duration: 0.5, ease: 'easeInOut' }} />
                          </div>
                          <motion.div className="text-blue-700 dark:text-white font-semibold" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.5, repeat: Infinity }}>
                            Analyzing video...
                          </motion.div>
                          <motion.div className="text-blue-700/80 dark:text-white/80 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                            ✨ Detecting items
                          </motion.div>
                        </motion.div>
                      </div>
                    )}
                    {/* Batch loader for all videos as one */}
                    {isBatchAnalyzing && (
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg" />
                        <motion.div className="relative flex flex-col items-center gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                          <div className="flex gap-2">
                            {[...Array(3)].map((_, i) => (
                              <motion.div key={i} className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center" animate={{ y: [0, -10, 0], scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}>
                                <Video className="w-4 h-4 text-blue-600 dark:text-white" />
                              </motion.div>
                            ))}
                          </div>
                          <div className="w-48 bg-white/20 rounded-full h-2 overflow-hidden">
                            <motion.div className="h-full bg-blue-500 rounded-full" initial={{ width: '0%' }} animate={{ width: `${batchProgress}%` }} transition={{ duration: 0.5, ease: 'easeInOut' }} />
                          </div>
                          <motion.div className="text-blue-700 dark:text-white font-semibold" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.5, repeat: Infinity }}>
                            Analyzing all videos as one...
                          </motion.div>
                          <motion.div className="text-blue-700/80 dark:text-white/80 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                            ✨ Detecting items from all videos
                          </motion.div>
                        </motion.div>
                      </div>
                    )}
                    {/* Per-video AI results (unchanged) */}
                    {videoAnalysis[video.url] && !analyzingVideos.has(video.url) && batchAnalysisResult.length == 0 (
                      <motion.div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">🤖 AI Analysis Results</h4>
                        <div className="mb-3">
                          <h5 className="text-xs font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">✅ Detected Items ({videoAnalysis[video.url].items.length})</h5>
                          <ul className="list-disc pl-6 text-gray-800 dark:text-gray-200">
                            {(videoAnalysis[video.url].items || []).map((item, itemIndex) => (
                              <li key={itemIndex}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        {/* Remove per-video Save to Room button */}
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>

              {/* Analyze Buttons Row */}
              <div className="flex flex-row gap-3 mb-3 justify-end">
                {/* Per-video Analyze Button */}
                {([...recordedVideos, ...uploadedVideos].some(v => !videoAnalysis[v.url]) && analyzingVideos.size === 0 && !isBatchAnalyzing && batchAnalysisResult.length === 0) && (
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-2 px-6 rounded-md shadow hover:scale-105 transition-all hover:cursor-pointer"
                    onClick={async () => {
                      await Promise.all(
                        [...recordedVideos, ...uploadedVideos].map((video, index) =>
                          !videoAnalysis[video.url] ? analyzeVideoWithAI(video.url, index, video.file, undefined) : null
                        )
                      );
                    }}
                    disabled={analyzingVideos.size > 0}
                  >
                    {analyzingVideos.size > 0 ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        Analyzing...
                      </span>
                    ) : (
                      <>
                      {[...recordedVideos, ...uploadedVideos].length == 1 ? 'Analyze video' : 'Analyze each video separately'}
                      </>
                    )}
                  </Button>
                )}
                {/* Analyze All Videos as One Button */}
                {([...recordedVideos, ...uploadedVideos].some(v => !videoAnalysis[v.url]) && !isBatchAnalyzing && batchAnalysisResult.length === 0 && analyzingVideos.size === 0) && (
                  <Button
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-2 px-6 rounded-md shadow hover:scale-105 transition-all hover:cursor-pointer"
                    onClick={analyzeAllVideosAsBatch}
                  >
                    Analyze All Videos as One
                  </Button>
                )}
              </div>
              {/* After the grid of new videos, show a single Save to Room button if all have been analyzed */}
              {[...recordedVideos, ...uploadedVideos].length > 0 &&
                ([...recordedVideos, ...uploadedVideos].every(v => videoAnalysis[v.url]) && !analyzingVideos.size && batchAnalysisResult.length === 0) && (
                  <div className="flex justify-end mt-4">
                    <Button
                      className="bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold py-2 px-6 rounded-md shadow hover:scale-105 transition-all hover:cursor-pointer"
                      onClick={saveVideosToRoom}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Saving...' : 'Save to Room'}
                    </Button>
                  </div>
                )
              }
            </div>
          )}
          {/* Batch AI Analysis Results below upload option */}
          {batchAnalysisResult.length > 0 && (
            <motion.div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-700">
              <h4 className="text-base font-semibold text-green-700 dark:text-green-300 mb-3 flex items-center gap-2">
                🤖 Batch AI Analysis Results (All Videos as One)
              </h4>
              <ul className="list-disc pl-6 text-gray-800 dark:text-gray-200">
                {batchAnalysisResult.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              {/* Save to Room button for batch */}
              <Button className="mt-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold py-2 px-6 rounded-md shadow hover:scale-105 transition-all hover:cursor-pointer" onClick={saveBatchToRoom} disabled={isProcessing || !room}>
                {isProcessing ? 'Saving...' : 'Save to Room'}
              </Button>
            </motion.div>
          )}
        </div>
        {/* Right: Previous Videos Section */}
        {/* Restore the right column layout for existing videos to the previous version */}
        <div
          className="w-full md:w-1/4 flex flex-col border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 z-10"
          style={{
            maxHeight: leftSectionHeight > 0 ? `${leftSectionHeight}px` : 'auto',
            minHeight: '400px'
          }}
        >
          <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 py-2 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl ms-2 w-full font-bold text-gray-900 dark:text-white mt-1 mb-1">Room Video Library</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100% - 60px)' }}>
            {/* Show batch analyses first */}
            {batchAnalyses.length > 0 && (
              <div className="flex p-4 flex-col gap-4">
                {batchAnalyses.map((batch, idx) => {
                  let dateString = '';
                  if (batch.createdAt) {
                    try {
                      const d = batch.createdAt.toDate ? batch.createdAt.toDate() : new Date(batch.createdAt.seconds ? batch.createdAt.seconds * 1000 : batch.createdAt);
                      dateString = 'Added ' + formatDistanceToNow(d, { addSuffix: true });
                    } catch { }
                  }
                  return (
                    <div
                      key={batch.id}
                      className="relative flex flex-col gap-2 rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer bg-white/90 dark:bg-gray-900/80 shadow group hover:border-blue-400 dark:hover:border-blue-300 transition-all p-4"
                      onClick={() => {
                        setSelectedModalVideo(batch.videoUrls[0]);
                        setSelectedModalVideoAnalysis({ items: batch.items, missingItems: [], type: 'batch', videoUrls: batch.videoUrls } as any);
                        setModalLoading(false);
                      }}
                    >
                      {/* Tag */}
                      <span className="absolute top-2 left-2 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full font-bold">Multi-Video Analysis</span>
                      {/* Video previews */}
                      <div className="flex gap-2 mb-2">
                        {batch.videoUrls.map((url: string, i: number) => (
                          <video key={i} src={url} className="w-16 h-12 object-cover rounded border border-gray-100 dark:border-gray-800" />
                        ))}
                      </div>
                      {dateString && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-full text-left mt-1">{dateString}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Show individual analyses */}
            {room.videos && room.videos.length > 0 ? (
              <div className="flex p-4 flex-col gap-4">
                {room.videos.filter(url => !url.startsWith('batch:')).map((videoUrl, idx) => {
                  const analysis = roomAnalyses[videoUrl];
                  let dateString = '';
                  if (analysis && analysis.createdAt) {
                    try {
                      const d = analysis.createdAt.toDate ? analysis.createdAt.toDate() : new Date(analysis.createdAt.seconds ? analysis.createdAt.seconds * 1000 : analysis.createdAt);
                      dateString = 'Added ' + formatDistanceToNow(d, { addSuffix: true });
                    } catch { }
                  }
                  return (
                    <div
                      key={idx}
                      className="relative flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer bg-white/90 dark:bg-gray-900/80 shadow group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 p-4"
                      onClick={async e => {
                        if ((e.target as HTMLElement).closest('.delete-btn')) return;
                        setSelectedModalVideo(videoUrl);
                        setModalLoading(true);
                        let analysis = roomAnalyses[videoUrl];
                        if (!analysis && room && room.id) {
                          try {
                            const analyses = await getCompletedAnalysesByRoomId(room.id);
                            analysis = analyses.find(a => a.cloudinaryUrl === videoUrl || a.videoUrl === videoUrl) || null;
                          } catch { }
                        }
                        setSelectedModalVideoAnalysis(analysis ? { ...analysis, type: 'individual', videoUrls: [videoUrl] } as any : null);
                        setModalLoading(false);
                      }}
                    >
                      {/* Add Single Video Analysis tag to each card, with better placement */}
                      <span className="absolute top-2 left-2 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 text-xs rounded-full font-bold z-10">Single Video Analysis</span>
                      {/* Video preview with play icon overlay */}
                      <div className="relative w-full h-32 rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden group">
                        <video
                          ref={(el) => { videoRefs.current[videoUrl] = el; }}
                          src={videoUrl}
                          className="w-full h-32 object-cover"
                          controls={playingVideo === videoUrl}
                          onTimeUpdate={(e) => {
                            const target = e.target as HTMLVideoElement;
                            if (target.currentTime > 0) {
                              target.style.opacity = '1';
                            }
                          }}
                          onEnded={() => stopVideo()}
                        />
                        {playingVideo !== videoUrl && (
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                            <PlayCircle className="w-8 h-8 text-white/80 drop-shadow-lg" />
                          </div>
                        )}
                      </div>
                      {/* Date below video (if available) */}
                      {dateString && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-full text-left mt-1">{dateString}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 opacity-70">
                <PlayCircle className="w-12 h-12 mb-2" />
                <div className="text-base font-semibold">No videos found</div>
                <div className="text-xs text-gray-500">Record or upload a video to get started.</div>
              </div>
            )}
          </div>
        </div>
      </div>

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
            }`}
          >
            {toast.message}
          </div>
        </motion.div>
      )}
      {/* Modal for video preview & AI results */}
      {selectedModalVideo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 md:p-0 bg-black/60 animate-fade-in" onClick={() => { setSelectedModalVideo(null); setSelectedModalVideoAnalysis(null); }}>
          {selectedModalVideoAnalysis && (selectedModalVideoAnalysis as any).type === 'batch' ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-md w-full relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 dark:hover:text-white text-3xl md:text-4xl" style={{ lineHeight: 1 }} title="Close" onClick={() => { setSelectedModalVideo(null); setSelectedModalVideoAnalysis(null); }}>&times;</button>
              {/* Multi-Video Analysis Tag */}
              <span className="inline-block mb-2 px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full font-bold">Multi-Video Analysis</span>
              <div className="flex flex-col gap-4 mb-4">
                {(selectedModalVideoAnalysis as any).videoUrls.map((url: string, i: number) => (
                  <div key={i} className="relative w-full h-48 rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-900">
                    <video
                      src={url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Combined Room Analysis Results</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">AI analysis of all videos combined to provide a comprehensive overview of your room.</p>
              <ul className="list-disc pl-6 text-gray-800 dark:text-gray-200">
                {(selectedModalVideoAnalysis as any).items.map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              {/* Ensure no related videos section is present here */}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-md w-full relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 dark:hover:text-white text-3xl md:text-4xl" style={{ lineHeight: 1 }} title="Close" onClick={() => { setSelectedModalVideo(null); setSelectedModalVideoAnalysis(null); }}>&times;</button>
              {/* Single Video Analysis Tag */}
              <span className="inline-block mb-2 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 text-xs rounded-full font-bold">Single Video Analysis</span>
              <div className="relative w-full h-48 rounded-lg mb-4 overflow-hidden bg-gray-900">
                <video
                  src={selectedModalVideo}
                  controls
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Room Analysis Results</h3>
              {modalLoading ? (
                <div className="text-gray-500 dark:text-gray-400">Loading analysis results...</div>
              ) : selectedModalVideoAnalysis && selectedModalVideoAnalysis.items && selectedModalVideoAnalysis.items.length > 0 ? (
                <ul className="list-disc pl-6 text-gray-800 dark:text-gray-200">
                  {selectedModalVideoAnalysis.items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">No items were detected in this video. Try uploading a clearer or more detailed video.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save Success Modal */}
      {showSaveSuccessModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={() => setShowSaveSuccessModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 dark:hover:text-white text-2xl" onClick={() => setShowSaveSuccessModal(false)}>&times;</button>
            <div className="flex flex-col items-center">
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
                className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Videos Saved Successfully!
              </motion.h2>

              <motion.div
                className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-2xl">
                  {room?.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {room?.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  {savedVideosCount} video{savedVideosCount !== 1 ? 's' : ''} added to your room
                </p>
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Ready for analysis</span>
                </div>
              </motion.div>

              <motion.div
                className="flex gap-3 w-full"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  variant="outline"
                  onClick={() => setShowSaveSuccessModal(false)}
                  className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Continue
                </Button>
                <Button
                  onClick={() => {
                    setShowSaveSuccessModal(false);
                    // Optionally scroll to the video library section
                    const videoLibrary = document.querySelector('.video-library-section');
                    if (videoLibrary) {
                      videoLibrary.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold flex items-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  View Videos
                </Button>
              </motion.div>

              <motion.div
                className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Your videos are now available in the room's video library for AI analysis.
              </motion.div>
            </div>
          </div>
        </div>
      )}
      {videoToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={() => setVideoToDelete(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 dark:hover:text-white text-2xl" onClick={() => setVideoToDelete(null)}>&times;</button>
            <div className="flex flex-col items-center">
              <Trash2 className="w-10 h-10 text-red-500 mb-2" />
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white text-center">Delete this video?</h3>
              <p className="text-gray-700 dark:text-gray-300 text-center mb-4">Are you sure you want to delete this video and its AI results? This action cannot be undone.</p>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setVideoToDelete(null)} disabled={isDeleting}>Cancel</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={async () => {
                    setIsDeleting(true);
                    // Remove from room
                    const newVideos = (room.videos || []).filter(url => url !== videoToDelete);
                    await updateRoomVideos(room.id, newVideos);
                    setRoom(prev => prev ? { ...prev, videos: newVideos } : null);
                    // Remove analysis from Firebase
                    try {
                      const analyses = await getCompletedAnalysesByRoomId(room.id);
                      const analysis = analyses.find(a => a.cloudinaryUrl === videoToDelete || a.videoUrl === videoToDelete);
                      if (analysis) {
                        // You may need to import and use deleteVideoAnalysis from firebaseService
                        // await deleteVideoAnalysis(analysis.id);
                      }
                    } catch { }
                    setIsDeleting(false);
                    setVideoToDelete(null);
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RoomVideoManagerPage;