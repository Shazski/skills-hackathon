import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import {
  Video,
  Upload,
  Camera,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  X,
  Eye,
} from 'lucide-react';
import {
  getHomeById,
  getRoomsByHomeId,
  getCompletedAnalysesByRoomId,
  createVideoAnalysis,
  updateVideoAnalysisResults,
} from '../../lib/firebaseService';
import type { VideoAnalysis, Room, Home } from '../../lib/firebaseService';

interface ComparisonResult {
  missingItems: string[];
  newItems: string[];
  commonItems: string[];
}

const InspectionPage = () => {
  const { homeId, roomId } = useParams<{ homeId: string; roomId: string }>();
  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomVideoAnalysis, setRoomVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [availableReferenceVideos, setAvailableReferenceVideos] = useState<VideoAnalysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectionVideo, setInspectionVideo] = useState<string | null>(null);
  const [inspectionFile, setInspectionFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [selectedRoomVideo, setSelectedRoomVideo] = useState<VideoAnalysis | null>(null);
  const [inspectionAnalysis, setInspectionAnalysis] = useState<string[] | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const roomVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const videoElement = roomVideoRef.current;

    const handleCanPlay = () => {
      videoElement?.play().catch(e => console.error('Autoplay failed:', e));
    };

    if (videoElement) {
      videoElement.addEventListener('canplay', handleCanPlay);
    }

    return () => {
      if (videoElement) {
        videoElement.removeEventListener('canplay', handleCanPlay);
      }
    };
  }, [selectedRoomVideo]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!homeId || !roomId) return;

      try {
        setLoading(true);
        const [homeData, roomsData] = await Promise.all([
          getHomeById(homeId),
          getRoomsByHomeId(homeId),
        ]);

        if (!isMounted) return;

        setHome(homeData);
        const currentRoom = roomsData.find((r) => r.id === roomId);
        setRoom(currentRoom || null);

        if (currentRoom) {
          const analyses = await getCompletedAnalysesByRoomId(roomId);
          if (!isMounted) return;

          const sortedAnalyses = analyses.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

          if (sortedAnalyses.length > 0) {
            console.log('Fetched reference videos:', sortedAnalyses);
            setAvailableReferenceVideos(sortedAnalyses);
            setSelectedRoomVideo(sortedAnalyses[0]);
            setRoomVideoAnalysis(sortedAnalyses[0]);
          } else {
            setError('No reference videos with analysis found for this room. Please analyze a video first.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load room data');
        }
        console.error(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [homeId, roomId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setIsRecording(true);
      setInspectionVideo(null);
      setInspectionFile(null);
      setComparisonResult(null);
      setInspectionAnalysis(null);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const supportedMimeTypes = [
        'video/mp4; codecs=avc1',
        'video/webm; codecs=vp9',
        'video/webm; codecs=vp8',
        'video/webm',
      ];
      const supportedMimeType = supportedMimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
        setError('No supported video format found for recording.');
        setIsRecording(false);
        return;
      }

      const options = { mimeType: supportedMimeType };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: supportedMimeType });
        chunksRef.current = [];
        const videoUrl = URL.createObjectURL(blob);
        const fileExtension = supportedMimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
        setInspectionVideo(videoUrl);
        setInspectionFile(new File([blob], `inspection.${fileExtension}`, { type: supportedMimeType }));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
    } catch (err) {
      setError('Failed to start recording. Please ensure camera permissions are granted.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const videoUrl = URL.createObjectURL(file);
      setInspectionVideo(videoUrl);
      setInspectionFile(file);
      setComparisonResult(null);
      setInspectionAnalysis(null);
    }
  };

  const analyzeInspectionVideo = async () => {
    if (!inspectionFile || !roomId) return;

    setIsAnalyzing(true);
    setComparisonResult(null);
    setInspectionAnalysis(null);

    try {
      const analysisId = await createVideoAnalysis(roomId, 'temp-url');

      setTimeout(async () => {
        const mockItems = ['Sofa', 'Table', 'Lamp', 'Rug', 'TV', 'Chair', 'Bookshelf'];
        const detectedItems = mockItems.filter(() => Math.random() > 0.3);
        setInspectionAnalysis(detectedItems);

        if (selectedRoomVideo && Array.isArray(selectedRoomVideo.items)) {
          const baseItems = selectedRoomVideo.items;
          const newItems = detectedItems.filter((item) => !baseItems.includes(item));
          const missingItems = baseItems.filter((item) => !detectedItems.includes(item));
          const commonItems = baseItems.filter((item) => detectedItems.includes(item));

          setComparisonResult({ newItems, missingItems, commonItems });
          await updateVideoAnalysisResults(analysisId, detectedItems, missingItems);
        } else {
          setComparisonResult({ newItems: detectedItems, missingItems: [], commonItems: [] });
          await updateVideoAnalysisResults(analysisId, detectedItems, []);
        }

        setIsAnalyzing(false);
      }, 3000);
    } catch (err) {
      setError('Failed to analyze video.');
      console.error(err);
      setIsAnalyzing(false);
    }
  };

  const clearInspection = () => {
    setInspectionVideo(null);
    setInspectionFile(null);
    setComparisonResult(null);
    setInspectionAnalysis(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="p-8"><div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div></div></div>;
  if (error) return <div className="p-8 text-red-500 flex items-center justify-center h-screen"><AlertTriangle className="w-8 h-8 mr-4"/>{error}</div>;
  if (!room) return <div className="p-8 text-red-500 flex items-center justify-center h-screen">Room not found.</div>;
  if (!selectedRoomVideo) return <div className="p-8 text-red-500 flex items-center justify-center h-screen"><AlertTriangle className="w-8 h-8 mr-4"/>No video found for comparison. Please upload a baseline video to the room first.</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 md:px-12 py-3">
        <div className="flex items-center justify-between">
          <Link to={`/homes/${homeId}/rooms/${roomId}`}>
            <Button variant="ghost" size="sm" className="flex items-center !p-0 gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              Back to Room
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl flex items-center justify-center text-xl">
              {room?.icon}
            </div>
            <div>
              <h1 className="text-lg font-bold">{room?.name} Inspection</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Comparing with the latest room analysis.</p>
            </div>
          </div>
          <div />
        </div>
      </header>

      <main className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h2 className="text-2xl font-bold mb-4">Reference Video</h2>
          <div className="bg-gray-200 dark:bg-gray-800 rounded-lg h-64 flex items-center justify-center">
           {selectedRoomVideo ? (
             <video
               key={selectedRoomVideo.id}
               ref={roomVideoRef}
               src={selectedRoomVideo.cloudinaryUrl || selectedRoomVideo.videoUrl}
               controls
               muted
               playsInline
               className="w-full h-full object-cover rounded-lg"
             />
           ) : (
             <p>No reference video selected</p>
           )}
         </div>
         <div className="mt-4">
           <h3 className="font-semibold mb-2">Available Reference Videos</h3>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
             {availableReferenceVideos.map((video) => (
               <div
                 key={video.id}
                 className={`relative rounded-lg overflow-hidden cursor-pointer border-2 ${selectedRoomVideo?.id === video.id ? 'border-blue-500' : 'border-transparent'}`}
                 onClick={() => {
                   setSelectedRoomVideo(video);
                   setRoomVideoAnalysis(video);
                 }}
               >
                 <video src={video.videoUrl} className="w-full h-24 object-cover" />
                 <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1">
                   {new Date(video.createdAt.toMillis()).toLocaleString()}
                 </div>
               </div>
             ))}
           </div>
         </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <h2 className="text-2xl font-bold mb-4">Inspection Video</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="w-full h-72 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-4">
              {inspectionVideo ? (
                <video ref={videoRef} src={inspectionVideo} controls className="w-full h-full object-cover rounded-lg" />
              ) : isRecording ? (
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover rounded-lg" />
              ) : (
                <p>Upload or record a video</p>
              )}
            </div>
            <div className="flex gap-4">
              <Button onClick={() => fileInputRef.current?.click()} className="flex-1">
                <Upload className="w-4 h-4 mr-2" /> Upload
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*" className="hidden" />
              {isRecording ? (
                <Button onClick={stopRecording} className="flex-1 bg-red-600 hover:bg-red-700">
                  <X className="w-4 h-4 mr-2" /> Stop Recording
                </Button>
              ) : (
                <Button onClick={startRecording} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" /> Record
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="flex justify-center gap-4 my-4">
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div className="inline-block">
                    <Button 
                      onClick={analyzeInspectionVideo} 
                      disabled={!inspectionFile || isAnalyzing || !selectedRoomVideo}
                      className="w-64 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold flex items-center gap-2"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze & Compare'}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!selectedRoomVideo && (
                  <TooltipContent>
                    <p>Cannot analyze because no baseline analysis exists for this room.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button onClick={clearInspection} variant="outline" disabled={!inspectionFile}>
              Clear
            </Button>
          </div>

          {comparisonResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-8">
              <h3 className="text-xl font-bold mb-4">Comparison Result</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold text-red-500 flex items-center"><X className="w-4 h-4 mr-2"/>Missing Items ({comparisonResult.missingItems.length})</h4>
                  <ul className="list-disc list-inside mt-2">
                    {comparisonResult.missingItems.map(item => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-green-500 flex items-center"><CheckCircle className="w-4 h-4 mr-2"/>New Items ({comparisonResult.newItems.length})</h4>
                  <ul className="list-disc list-inside mt-2">
                    {comparisonResult.newItems.map(item => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-500 flex items-center"><Eye className="w-4 h-4 mr-2"/>Common Items ({comparisonResult.commonItems.length})</h4>
                  <ul className="list-disc list-inside mt-2">
                    {comparisonResult.commonItems.map(item => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default InspectionPage;
