import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { extractFramesFromVideo } from '@/lib/utils';
import jsPDF from 'jspdf';
import {
  Video,
  Upload,
  Camera,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  X,
  Brain,
  Plus,
  Download,
  Search,
} from 'lucide-react';
import {
  getHomeById,
  getRoomsByHomeId,
  getCompletedAnalysesByRoomId,
  createVideoAnalysis,
  updateVideoAnalysisResults,
} from '@/lib/firebaseService';
import type { VideoAnalysis, Room, Home } from '@/lib/firebaseService';

interface ComparisonResult {
  missingItems: string[];
  newItems: string[];
  commonItems: string[];
  inspectionItems?: string[];
  referenceItems?: string[];
  missingItemsCount: number;
  newItemsCount: number;
  commonItemsCount: number;
  totalReferenceItems: number;
  totalInspectionItems: number;
  groupedMissingItems: Array<{ item: string; count: number }>;
  groupedNewItems: Array<{ item: string; count: number }>;
  groupedCommonItems: Array<{ item: string; count: number }>;
}



const InspectionPage = () => {
  const navigate = useNavigate();
  const { homeId, roomId } = useParams<{ homeId: string; roomId: string }>();
  
  // State management
  const [home, setHome] = useState<Home | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [availableReferenceVideos, setAvailableReferenceVideos] = useState<VideoAnalysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectionVideo, setInspectionVideo] = useState<string | null>(null);
  const [inspectionFile, setInspectionFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [selectedRoomVideo, setSelectedRoomVideo] = useState<VideoAnalysis | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [currentCameraMode, setCurrentCameraMode] = useState<'user' | 'environment'>('user');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const livePreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch room and reference videos data
  useEffect(() => {
    const fetchData = async () => {
      if (!homeId || !roomId) return;

      try {
        setLoading(true);
        
        // Try to fetch data, but handle authentication errors gracefully
        let homeData = null;
        let roomsData: any[] = [];
        
        try {
          const [homeResult, roomsResult] = await Promise.all([
            getHomeById(homeId),
            getRoomsByHomeId(homeId),
          ]);
          homeData = homeResult;
          roomsData = roomsResult;
        } catch (authError) {
          console.log('Authentication required for data fetching, continuing without data');
          // Continue without data for public access
        }

        setHome(homeData);
        const currentRoom = roomsData.find((r) => r.id === roomId);
        setRoom(currentRoom || null);

        if (currentRoom) {
          console.log('Current room:', currentRoom);
          console.log('Room videos:', currentRoom.videos);
          
          if (!roomId) {
            console.error('roomId is undefined or null');
            setError('Room ID is missing');
            return;
          }
          
          // Get room's videos first
          const roomVideos = currentRoom.videos || [];
          console.log('Room videos count:', roomVideos.length);
          
          if (roomVideos.length === 0) {
            console.log('No videos in room');
            setAvailableReferenceVideos([]);
            return;
          }
          
          // Try to get analyses, but handle authentication errors
          try {
            const allAnalyses = await getCompletedAnalysesByRoomId(roomId);
            console.log('All analyses for room:', allAnalyses);
            
            // Filter analyses to only include those that match room videos
            const roomVideoAnalyses = allAnalyses.filter(analysis => 
              roomVideos.includes(analysis.videoUrl) || roomVideos.includes(analysis.cloudinaryUrl || '')
            );
            
            console.log('Room video analyses:', roomVideoAnalyses);
            setAvailableReferenceVideos(roomVideoAnalyses);
            
            // Automatically select the most recent analysis if available
            if (roomVideoAnalyses.length > 0) {
              setSelectedRoomVideo(roomVideoAnalyses[0]);
            }
          } catch (analysisError) {
            console.log('Authentication required for analysis data, continuing without reference videos');
            setAvailableReferenceVideos([]);
          }
        } else {
          console.log('Room not found, but continuing for public access');
          // Don't set error for public access, just continue without room data
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        // Don't set error for public access, just log it
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [homeId, roomId]);

  // Monitor video element and force play when stream is available
  useEffect(() => {
    if (isRecording && livePreviewRef.current) {
      const video = livePreviewRef.current;
      
      // Check if video has a stream and force play
      const checkAndPlay = () => {
        if (video.srcObject && !video.paused) {
          console.log('Video is playing, camera ready');
          setCameraReady(true);
        } else if (video.srcObject && video.paused) {
          console.log('Video has stream but is paused, forcing play...');
          video.play().then(() => {
            console.log('Forced play successful');
            setCameraReady(true);
          }).catch(console.error);
        } else if (!video.srcObject) {
          console.log('Video has no stream, this is the problem!');
        }
      };
      
      // Check immediately and after delays
      checkAndPlay();
      const interval = setInterval(checkAndPlay, 200);
      
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  // Ensure video element is properly configured when component mounts
  useEffect(() => {
    console.log('Component mounted, checking video element...');
    
    if (livePreviewRef.current) {
      console.log('Video element mounted, configuring...');
      const video = livePreviewRef.current;
      
      // Set default attributes
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      
      console.log('Video element configured with attributes:', {
        autoplay: video.autoplay,
        muted: video.muted,
        playsInline: video.playsInline
      });
    } else {
      console.log('Video element not found on mount, will check later...');
    }
  }, []);
  
  // Additional check for video element availability
  useEffect(() => {
    const checkVideoElement = () => {
      if (!livePreviewRef.current) {
        console.log('Live preview video element still not available, checking DOM...');
        const videoElement = document.querySelector('[data-video-type="live-preview"]');
        if (videoElement) {
          console.log('Found live preview video element in DOM, updating ref...');
          livePreviewRef.current = videoElement as HTMLVideoElement;
        }
      }
    };
    
    // Check immediately and after a delay
    checkVideoElement();
    const timeout = setTimeout(checkVideoElement, 500);
    
    return () => clearTimeout(timeout);
  }, []);

  // Force video to play function
  const forceVideoPlay = async (videoElement: HTMLVideoElement) => {
    try {
      if (videoElement.srcObject && videoElement.paused) {
        console.log('Forcing video play...');
        await videoElement.play();
        console.log('Video play successful');
        setCameraReady(true);
        return true;
      }
    } catch (error) {
      console.error('Force play failed:', error);
    }
    return false;
  };

  // Mobile video play function
  const playVideoOnMobile = async (videoElement: HTMLVideoElement) => {
    try {
      console.log('Attempting to play video on mobile...');
      
      // Set mobile-specific attributes for iPhone
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('x5-playsinline', 'true');
      videoElement.setAttribute('x5-video-player-type', 'h5');
      videoElement.setAttribute('x5-video-player-fullscreen', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('playsinline', 'true');
      videoElement.playsInline = true;
      
      // Force load the video
      videoElement.load();
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        videoElement.addEventListener('loadedmetadata', resolve, { once: true });
        videoElement.addEventListener('canplay', resolve, { once: true });
        // Timeout after 3 seconds
        setTimeout(resolve, 3000);
      });
      
      // Try to play
      await videoElement.play();
      console.log('Mobile video play successful');
      return true;
    } catch (error) {
      console.error('Mobile video play failed:', error);
      
      // Fallback: try with user interaction
      videoElement.addEventListener('click', async () => {
        try {
          await videoElement.play();
          console.log('Mobile video play successful after click');
        } catch (clickError) {
          console.error('Mobile video play failed after click:', clickError);
        }
      }, { once: true });
      
      // Additional fallback: try with touchstart event for iOS
      videoElement.addEventListener('touchstart', async () => {
        try {
          await videoElement.play();
          console.log('Mobile video play successful after touch');
        } catch (touchError) {
          console.error('Mobile video play failed after touch:', touchError);
        }
      }, { once: true });
      
      return false;
    }
  };

  // Switch camera function for mobile devices
  const switchCamera = async () => {
    try {
      console.log('Switching camera...');
      
      // Get current stream from video element instead of media recorder
      const currentStream = livePreviewRef.current?.srcObject as MediaStream;
      if (!currentStream) {
        console.log('No active stream to switch');
        return;
      }
      
      // Stop current stream
      currentStream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind, track.label);
        track.stop();
      });
      
      // Determine current facing mode and switch
      const currentVideoTrack = currentStream.getVideoTracks()[0];
      if (!currentVideoTrack) {
        console.log('No video track found');
        return;
      }
      
      const currentFacingMode = currentVideoTrack.getSettings().facingMode;
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      
      // Update camera mode state
      setCurrentCameraMode(newFacingMode);
      
      console.log(`Switching from ${currentFacingMode} to ${newFacingMode} camera`);
      
      // Get new stream with different camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: newFacingMode
        }
      });
      
      console.log('New stream obtained:', newStream);
      console.log('New stream tracks:', newStream.getTracks());
      
      // Update video element
      if (livePreviewRef.current) {
        // Clear existing stream
        livePreviewRef.current.srcObject = null;
        
        // Set new stream
        livePreviewRef.current.srcObject = newStream;
        
        // Play the new stream
        try {
          await livePreviewRef.current.play();
          console.log('New camera stream playing successfully');
        } catch (playError) {
          console.error('Failed to play new stream:', playError);
          // Try again after a short delay
          setTimeout(async () => {
            try {
              await livePreviewRef.current?.play();
              console.log('Delayed play successful');
            } catch (retryError) {
              console.error('Delayed play failed:', retryError);
            }
          }, 100);
        }
      }
      
      // Create new media recorder with the new stream
      if (mediaRecorderRef.current) {
        console.log('Creating new media recorder with updated stream...');
        
        // Stop the old media recorder
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        
        // Create new media recorder with the new stream
        const newMediaRecorder = new MediaRecorder(newStream);
        mediaRecorderRef.current = newMediaRecorder;
        
        // Set up the new media recorder
        newMediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        
        newMediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setInspectionVideo(url);
          setInspectionFile(new File([blob], 'inspection.webm', { type: 'video/webm' }));
        };
        
        // Start the new media recorder
        newMediaRecorder.start();
        console.log('New media recorder started successfully');
      }
      
      console.log('Camera switched successfully');
      
    } catch (error) {
      console.error('Failed to switch camera:', error);
      setError('Failed to switch camera. Please try again.');
    }
  };

  // Handle video recording
  const startRecording = async () => {
    try {
      console.log('Starting camera access...');
      
      // Clean up any existing recording sections and video elements first
      const allRecordingSections = document.querySelectorAll('[data-recording-section]');
      const allLivePreviewVideos = document.querySelectorAll('[data-live-preview="true"]');
      
      console.log(`Found ${allRecordingSections.length} recording sections and ${allLivePreviewVideos.length} live preview videos`);
      
      // Remove all existing recording sections
      allRecordingSections.forEach(section => {
        console.log('Removing recording section:', section);
        section.remove();
      });
      
      // Remove any standalone live preview videos
      allLivePreviewVideos.forEach(video => {
        console.log('Removing live preview video:', video);
        video.remove();
      });
      
      // Reset refs
      livePreviewRef.current = null;
      
      console.log('Cleanup completed');
      
      // Ensure video element is available before getting camera stream
      if (!livePreviewRef.current) {
        console.log('Video element not ready, will create one after getting stream...');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' // Use front camera
        } 
      });
      
      console.log('Camera stream obtained:', stream);
      console.log('Video tracks:', stream.getVideoTracks());
      
      // Set initial camera mode
      const videoTrack = stream.getVideoTracks()[0];
      const facingMode = videoTrack.getSettings().facingMode as 'user' | 'environment';
      setCurrentCameraMode(facingMode || 'user');
      console.log('Initial camera mode:', facingMode);
      
      // Check if video element is properly mounted
      if (!livePreviewRef.current) {
        console.log('Live preview video element not found, creating one...');
        
        // Double-check if there are any existing live preview videos in the DOM
        const existingLiveVideos = document.querySelectorAll('[data-live-preview="true"]');
        if (existingLiveVideos.length > 0) {
          console.log(`Found ${existingLiveVideos.length} existing live preview videos, removing them`);
          existingLiveVideos.forEach(video => video.remove());
        }
        
        // Simple approach: create video element directly in the recording section
        let recordingSection = document.querySelector('[data-recording-section]');
        if (!recordingSection) {
          console.log('Recording section not found, creating one...');
          
          // Find the inspection section to insert the recording section
          const inspectionSection = document.querySelector('[data-inspection-section]');
          if (inspectionSection) {
            // Check if there's already a recording section (avoid duplicates)
            const existingRecordingSection = inspectionSection.querySelector('[data-recording-section]');
            if (existingRecordingSection) {
              recordingSection = existingRecordingSection;
              console.log('Found existing recording section, reusing it');
            } else {
              // Create recording section
              recordingSection = document.createElement('div');
              recordingSection.className = 'space-y-4';
              recordingSection.setAttribute('data-recording-section', 'true');
              
              // Insert after the inspection section header
              const header = inspectionSection.querySelector('.p-4.border-b');
              if (header) {
                header.parentNode?.insertBefore(recordingSection, header.nextSibling);
              } else {
                inspectionSection.appendChild(recordingSection);
              }
              
              console.log('Created new recording section');
            }
          } else {
            console.error('Inspection section not found, cannot create recording section');
            setError('Video element not available. Please refresh the page.');
            return;
          }
        } else {
          console.log('Found existing recording section, reusing it');
        }
        
        console.log('Found recording section, creating video element...');
        
        // Create new video element
        const newVideo = document.createElement('video');
        newVideo.setAttribute('data-live-preview', 'true');
        newVideo.setAttribute('data-video-type', 'live-preview');
        newVideo.autoplay = true;
        newVideo.muted = true;
        newVideo.playsInline = true;
        newVideo.setAttribute('webkit-playsinline', 'true');
        newVideo.setAttribute('x5-playsinline', 'true');
        newVideo.setAttribute('x5-video-player-type', 'h5');
        newVideo.setAttribute('x5-video-player-fullscreen', 'true');
        newVideo.className = 'w-full h-full object-cover';
        newVideo.style.transform = 'scaleX(-1)';
        
        // Find or create the video container
        let videoContainer = recordingSection.querySelector('.aspect-video');
        if (!videoContainer) {
          console.log('Creating new video container...');
          videoContainer = document.createElement('div');
          videoContainer.className = 'relative aspect-video bg-black rounded-lg overflow-hidden';
          recordingSection.insertBefore(videoContainer, recordingSection.firstChild);
        } else {
          console.log('Found existing video container, clearing and reusing it');
          // Clear any existing content
          videoContainer.innerHTML = '';
        }
        
        // Add video to container
        videoContainer.appendChild(newVideo);
        console.log('Video element added to container');
        
        // Update ref
        livePreviewRef.current = newVideo;
        console.log('Created new live preview video element successfully');
        console.log('Video element details:', {
          tagName: newVideo.tagName,
          className: newVideo.className,
          dataAttributes: {
            livePreview: newVideo.getAttribute('data-live-preview'),
            videoType: newVideo.getAttribute('data-video-type')
          }
        });
        
        // Add event listeners
        newVideo.onloadedmetadata = () => {
          console.log('New video element metadata loaded');
          setCameraReady(true);
        };
        newVideo.onplay = () => {
          console.log('New video element playing');
          setCameraReady(true);
        };
        
        // Verify ref is set
        console.log('livePreviewRef.current after creation:', livePreviewRef.current);
      }
      
      console.log('Video element found, proceeding with setup...');
      
      if (livePreviewRef.current) {
        console.log('Setting live preview srcObject...');
        console.log('Video element found:', livePreviewRef.current);
        console.log('Stream active:', stream.active);
        console.log('Stream tracks:', stream.getTracks());
        
        // Clear any existing source
        livePreviewRef.current.srcObject = null;
        
        // Set the new stream
        livePreviewRef.current.srcObject = stream;
        
        // Verify stream was set
        console.log('Stream set, checking srcObject:', livePreviewRef.current.srcObject);
        
        // Configure video element for live streaming
        livePreviewRef.current.autoplay = true;
        livePreviewRef.current.muted = true;
        livePreviewRef.current.playsInline = true;
        
        // Wait for video to be ready
        livePreviewRef.current.onloadedmetadata = () => {
          console.log('Live preview metadata loaded, starting play...');
          setCameraReady(true);
          
          // Force play immediately
          livePreviewRef.current?.play().then(() => {
            console.log('Live preview playing successfully');
          }).catch((err) => {
            console.error('Failed to play live preview:', err);
            // Try again after a short delay
            setTimeout(() => {
              livePreviewRef.current?.play().catch(console.error);
            }, 100);
          });
        };
        
        // Additional event listeners for debugging
        livePreviewRef.current.onplay = () => {
          console.log('Live preview started playing');
          setCameraReady(true);
        };
        livePreviewRef.current.onpause = () => console.log('Live preview paused');
        livePreviewRef.current.onerror = (e) => console.error('Live preview error:', e);
        livePreviewRef.current.oncanplay = () => {
          console.log('Live preview can play');
          setCameraReady(true);
        };
        
        // Force play after a short delay
        setTimeout(() => {
          if (livePreviewRef.current && livePreviewRef.current.paused) {
            console.log('Forcing live preview play after delay...');
            livePreviewRef.current.play().catch(console.error);
          }
        }, 100);
        
        // Additional fallback - try to play immediately
        if (livePreviewRef.current) {
          console.log('Attempting immediate play...');
          livePreviewRef.current.play().catch((err) => {
            console.log('Immediate play failed, will retry:', err);
          });
        }
        
        // More aggressive approach - check stream and force play
        if (stream && stream.active) {
          console.log('Stream is active, forcing video setup...');
          setTimeout(() => {
            if (livePreviewRef.current) {
              livePreviewRef.current.srcObject = stream;
              forceVideoPlay(livePreviewRef.current);
            }
          }, 50);
        }
        
        // Final attempt - force play after everything is set up
        setTimeout(() => {
          if (livePreviewRef.current) {
            console.log('Final attempt to force play...');
            forceVideoPlay(livePreviewRef.current);
          }
        }, 300);
        
        // Last resort - recreate video element if needed
        setTimeout(() => {
          if (livePreviewRef.current && !cameraReady) {
            console.log('Last resort: recreating video element...');
            const video = livePreviewRef.current;
            video.srcObject = null;
            video.srcObject = stream;
            video.play().then(() => {
              console.log('Recreated video play successful');
              setCameraReady(true);
            }).catch(console.error);
          }
        }, 500);
        
        // Final fallback - ensure video element is properly configured
        setTimeout(() => {
          if (livePreviewRef.current && !cameraReady) {
            console.log('Final fallback: ensuring video configuration...');
            const video = livePreviewRef.current;
            
            // Force all attributes
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;
            video.srcObject = stream;
            
            // Try to play again
            video.play().then(() => {
              console.log('Final fallback play successful');
              setCameraReady(true);
            }).catch((err) => {
              console.error('Final fallback failed:', err);
              // Show error to user
              setError('Camera preview failed to start. Please try again.');
            });
          }
        }, 800);
        
        // Ultimate fallback - create new video element
        setTimeout(() => {
          if (!cameraReady) {
            console.log('Ultimate fallback: creating new video element...');
            
            // Create a new video element
            const newVideo = document.createElement('video');
            newVideo.autoplay = true;
            newVideo.muted = true;
            newVideo.playsInline = true;
            newVideo.style.cssText = 'width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);';
            
            // Replace the current video element
            if (livePreviewRef.current && livePreviewRef.current.parentNode) {
              const parent = livePreviewRef.current.parentNode;
              parent.replaceChild(newVideo, livePreviewRef.current);
              
              // Update the ref
              livePreviewRef.current = newVideo;
              
              // Set stream and play
              newVideo.srcObject = stream;
              newVideo.play().then(() => {
                console.log('New video element play successful');
                setCameraReady(true);
              }).catch(console.error);
            }
          }
        }, 1000);
      }

      const getOptimalMimeType = () => {
    // Priority 1: H.264 video in MP4 container
    if (MediaRecorder.isTypeSupported('video/mp4; codecs=h264')) {
        console.log("Using 'video/mp4; codecs=h264'");
        return 'video/mp4; codecs=h264';
    }
    // Priority 2: Standard MP4
    if (MediaRecorder.isTypeSupported('video/mp4')) {
        console.log("Using 'video/mp4'");
        return 'video/mp4';
    }
    // Priority 3: VP9 video in WebM container (high quality)
    if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        console.log("Using 'video/webm; codecs=vp9'");
        return 'video/webm; codecs=vp9';
    }
    // Priority 4: Default WebM (widely supported)
    if (MediaRecorder.isTypeSupported('video/webm')) {
        console.log("Using 'video/webm'");
        return 'video/webm';
    }
    console.log("Using default video/webm");
    return 'video/webm'; // Fallback
};

const options = {
    mimeType: getOptimalMimeType(),
};

      const mediaRecorder = new MediaRecorder(stream, options);
      // const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
  // Get the actual MIME type used by the recorder
  const recordedMimeType = mediaRecorderRef.current.mimeType;
  console.log('Recording stopped. Final MIME Type:', recordedMimeType);
  
  // Create a blob with the correct MIME type
  const blob = new Blob(chunksRef.current, { type: recordedMimeType });
  const url = URL.createObjectURL(blob);
  setInspectionVideo(url);
  
  // Create the File object with the correct type and a reasonable filename
  const fileExtension = recordedMimeType.split('/')[1].split(';')[0];
  setInspectionFile(new File([blob], `inspection.${fileExtension}`, { type: recordedMimeType }));
};

      
      mediaRecorder.start();
      setIsRecording(true);
      console.log('Recording started successfully');
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
      console.error('Camera access error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setCameraReady(false);
      
      console.log('Cleaning up recording section...');
      const recordingSection = document.querySelector('[data-recording-section]');
      if (recordingSection) {
        recordingSection.remove();
        console.log('Recording section removed');
      }
      
      // Also remove any standalone live preview videos
      const livePreviewVideos = document.querySelectorAll('[data-live-preview="true"]');
      livePreviewVideos.forEach(video => {
        console.log('Removing live preview video during stop');
        video.remove();
      });
      
      livePreviewRef.current = null;
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setInspectionVideo(url);
      setInspectionFile(file);
    }
  };

  // Enhanced OpenAI analysis function
  const analyzeFramesWithOpenAI = async (frames: string[], referenceItems: string[]): Promise<string[]> => {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      const openaiContent = [
        {
          type: "text" as const,
          text: `You are an expert room inspector with exceptional attention to detail. Your task is to analyze these video frames and list EVERY visible item with maximum precision.

CRITICAL INSTRUCTIONS FOR MAXIMUM DETAIL:
- List EVERY single item you can see, no matter how small or seemingly insignificant
- Include specific details: exact colors, materials, sizes, locations, quantities, patterns
- Be extremely thorough - don't miss any objects, furniture, decorative items, or details
- Consider items in: corners, on surfaces, hanging, placed around, partially visible, in shadows
- Look for: clothing items, accessories, electronics, books, papers, containers, plants, artwork
- Pay attention to: wall decorations, floor items, table surfaces, shelves, drawers, beds, chairs
- Be precise about: exact locations, orientations, conditions, brands, styles

🚨 ULTRA-AGGRESSIVE COUNTING REQUIREMENTS 🚨
- YOU MUST COUNT EVERY SINGLE ITEM with PERFECT ACCURACY
- ALWAYS provide exact counts using DIGITS (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, etc.)
- NEVER use vague terms like "several", "many", "few", "some", "a few", "multiple", "various"
- NEVER use written words like "three", "five", "two", "four", "six", "seven", "eight"
- COUNT INDIVIDUALLY: Look at each item and count them one by one
- BE EXTREMELY PRECISE: If you see 7 bowls, say "7 bowls", not "several bowls"
- Examples of CORRECT format:
  * "7 white ceramic bowls on kitchen counter"
  * "4 black wooden chairs around dining table"
  * "3 blue throw pillows on sofa"
  * "6 white plates in dish rack"
  * "2 coffee mugs on table"
  * "5 books on shelf"
- Examples of INCORRECT format:
  * "several white bowls" ❌
  * "many chairs" ❌
  * "three white bowls" ❌
  * "multiple cups" ❌
  * "various items" ❌

Reference items from previous analysis (for context): ${referenceItems.join(', ')}

🚨 FINAL COUNTING INSTRUCTIONS 🚨
- COUNT EVERY ITEM INDIVIDUALLY - don't estimate, don't guess
- If you see 8 plates, count them one by one and say "8 plates"
- If you see 12 books, count them individually and say "12 books"
- BE EXTREMELY THOROUGH in counting - don't miss any items
- Look carefully at each surface, corner, shelf, and area
- Count items even if they're partially hidden or in shadows
- Your accuracy in counting is CRITICAL for room inspection

Format your response as a numbered list with each item on a separate line. Be extremely detailed and thorough. ALWAYS provide exact counts with DIGITS.`
        },
        ...frames.map(frame => ({
          type: "image_url" as const,
          image_url: {
            url: frame
          }
        }))
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${apiKey}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert at analyzing video content and identifying objects. Format your response as a clean list with each item on a separate line."
            },
            {
              role: "user",
              content: openaiContent,
            },
          ],
          max_tokens: 3000,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      const analysisResult = data.choices?.[0]?.message?.content || "";
      
      // Parse the results to extract items
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

      // Validate that items have numeric counts
      const validatedItems = items.map(item => {
        // Check if item starts with a number
        const startsWithNumber = /^\d+/.test(item);
        if (!startsWithNumber) {
          console.warn(`⚠️ Item missing numeric count: "${item}" - AI should provide exact count`);
        }
        return item;
      });

      // Log validation results
      const itemsWithCounts = validatedItems.filter(item => /^\d+/.test(item));
      const itemsWithoutCounts = validatedItems.filter(item => !/^\d+/.test(item));
      
      console.log(`=== COUNTING VALIDATION ===`);
      console.log(`Items with numeric counts: ${itemsWithCounts.length}`);
      console.log(`Items missing counts: ${itemsWithoutCounts.length}`);
      if (itemsWithoutCounts.length > 0) {
        console.warn(`Items missing counts:`, itemsWithoutCounts);
      }
      console.log(`===========================`);

      return items.length > 0 ? items : [analysisResult];
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  };

  // AI-powered comparison logic - much more accurate than frontend rules
  const compareItemsWithAI = async (referenceItems: string[], inspectionItems: string[]): Promise<ComparisonResult> => {
    try {
      console.log('=== USING AI FOR COMPARISON ===');
      console.log('Reference Items:', referenceItems);
      console.log('Inspection Items:', inspectionItems);

      // Filter out generic AI responses
      const filterGenericResponses = (items: string[]): string[] => {
        const genericPatterns = [
          /i'm sorry/i,
          /i can't identify/i,
          /please share/i,
          /if you have other/i,
          /i'll be happy to help/i,
          /based only on this/i,
          /please provide/i,
          /unfortunately/i,
          /i cannot/i,
          /i'm unable/i,
          /no items detected/i,
          /no visible items/i,
          /nothing visible/i,
          /cannot see/i,
          /unable to identify/i
        ];
        
        return items.filter(item => {
          const itemLower = item.toLowerCase();
          return !genericPatterns.some(pattern => pattern.test(itemLower)) && 
                 item.trim().length > 5 &&
                 !item.includes('...') &&
                 !item.startsWith('I\'m sorry') &&
                 !item.startsWith('Unfortunately') &&
                 !item.startsWith('I cannot') &&
                 !item.startsWith('I\'m unable');
        });
      };

      const filteredReferenceItems = filterGenericResponses(referenceItems);
      const filteredInspectionItems = filterGenericResponses(inspectionItems);

      // Check if content might be identical or very similar
      const isLikelyIdentical = filteredReferenceItems.length === filteredInspectionItems.length && 
        filteredReferenceItems.some(refItem => 
          filteredInspectionItems.some(inspItem => 
            refItem.toLowerCase().includes(inspItem.toLowerCase().split(' ')[0]) || 
            inspItem.toLowerCase().includes(refItem.toLowerCase().split(' ')[0])
          )
        );

      // Enhanced identical content detection
      const hasExactMatches = filteredReferenceItems.some(refItem => 
        filteredInspectionItems.some(inspItem => 
          refItem.toLowerCase() === inspItem.toLowerCase() ||
          refItem.toLowerCase().replace(/\s+/g, ' ') === inspItem.toLowerCase().replace(/\s+/g, ' ')
        )
      );

      const isDefinitelyIdentical = hasExactMatches || 
        (filteredReferenceItems.length === filteredInspectionItems.length && 
         filteredReferenceItems.length > 0 &&
         filteredReferenceItems.every((refItem, index) => {
           const inspItem = filteredInspectionItems[index];
           if (!inspItem) return false;
           const refNormalized = refItem.toLowerCase().replace(/\s+/g, ' ').trim();
           const inspNormalized = inspItem.toLowerCase().replace(/\s+/g, ' ').trim();
           return refNormalized === inspNormalized || 
                  refNormalized.includes(inspNormalized.split(' ')[0]) ||
                  inspNormalized.includes(refNormalized.split(' ')[0]);
         }));

      // Create ultra-simple prompt for exact matching
      const prompt = `You are comparing two lists of room items. Your job is to categorize them EXACTLY.

${isDefinitelyIdentical ? '🚨🚨🚨 IDENTICAL CONTENT DETECTED 🚨🚨🚨\nThis appears to be the SAME video or nearly identical content.\nALL items should be marked as COMMON.\nNO missing or new items should exist.\n🚨🚨🚨' : ''}

REFERENCE ITEMS (original):
${filteredReferenceItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

INSPECTION ITEMS (current):
${filteredInspectionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

🚨 CRITICAL RULES - NO EXCEPTIONS 🚨

${isDefinitelyIdentical ? '🚨 IDENTICAL CONTENT RULES 🚨\n- Since this is identical content, ALL items go to COMMON\n- NO items should be in MISSING\n- NO items should be in NEW\n- This is a 100% COMMON scenario\n' : ''}

1. COMMON ITEMS: Items that are the SAME or VERY SIMILAR
   - "5 white bowls on counter" vs "5 white bowls on counter" = COMMON
   - "3 black chairs" vs "3 black chairs" = COMMON
   - "2 coffee mugs" vs "2 coffee mugs" = COMMON
   - "white bowl on table" vs "white bowl on table" = COMMON (identical)
   - "black chair" vs "black chair" = COMMON (identical)

2. MISSING ITEMS: ONLY items from reference that are COMPLETELY ABSENT from inspection
   - "5 white bowls on counter" in reference, "3 white bowls on counter" in inspection = MISSING: "2 white bowls on counter"
   - "red book on shelf" in reference, no books in inspection = MISSING: "red book on shelf"
   ${isDefinitelyIdentical ? '- Since this is identical content, there should be NO missing items' : ''}

3. NEW ITEMS: ONLY items in inspection that were COMPLETELY ABSENT from reference
   - "3 white bowls on counter" in reference, "5 white bowls on counter" in inspection = NEW: "2 white bowls on counter"
   - "blue vase on table" in inspection, no vase in reference = NEW: "blue vase on table"
   ${isDefinitelyIdentical ? '- Since this is identical content, there should be NO new items' : ''}

🚨 MATHEMATICAL VALIDATION 🚨
- Reference items = Common items + Missing items
- Inspection items = Common items + New items
- This MUST be mathematically correct

${isDefinitelyIdentical ? '🚨 IDENTICAL CONTENT EXPECTATION 🚨\nExpected result for identical content:\n- Common: ALL items\n- Missing: 0 items\n- New: 0 items\n' : ''}

EXAMPLE:
Reference: ["5 bowls", "3 chairs", "2 cups"] (3 items)
Inspection: ["3 bowls", "3 chairs", "4 cups"] (3 items)
Result:
- Common: ["3 chairs"] (1 item)
- Missing: ["2 bowls"] (1 item) 
- New: ["2 cups"] (1 item)
Math: 3 = 1 + 1 + 1 ✓

Respond with ONLY this JSON (no other text):
{
  "missingItems": ["exact item description from reference"],
  "newItems": ["exact item description from inspection"],
  "commonItems": ["exact item description from reference"]
}`;

      console.log('Sending to AI for comparison...');
      
      // Call OpenAI API for comparison
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a precise room inspection expert. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      console.log('AI Response:', aiResponse);
      
      // Parse AI response
      let parsedResponse;
      try {
        // Extract JSON from response if it contains extra text
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          parsedResponse = JSON.parse(aiResponse);
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        console.log('Raw AI response:', aiResponse);
        throw new Error('AI response could not be parsed');
      }

      const { missingItems = [], newItems = [], commonItems = [] } = parsedResponse;

      // Log AI response for debugging
      console.log('=== AI RESPONSE ===');
      console.log('Missing Items:', missingItems);
      console.log('New Items:', newItems);
      console.log('Common Items:', commonItems);
      console.log('==================');

      // Mathematical validation to catch AI mistakes
      const totalReference = filteredReferenceItems.length;
      const totalInspection = filteredInspectionItems.length;
      const totalCommon = commonItems.length;
      const totalMissing = missingItems.length;
      const totalNew = newItems.length;

      // Check mathematical consistency
      const referenceCheck = totalCommon + totalMissing;
      const inspectionCheck = totalCommon + totalNew;
      
      console.log('=== MATHEMATICAL VALIDATION ===');
      console.log(`Reference items: ${totalReference} | Common + Missing: ${totalCommon} + ${totalMissing} = ${referenceCheck}`);
      console.log(`Inspection items: ${totalInspection} | Common + New: ${totalCommon} + ${totalNew} = ${inspectionCheck}`);
      
      if (Math.abs(totalReference - referenceCheck) > 1 || Math.abs(totalInspection - inspectionCheck) > 1) {
        console.warn('⚠️ AI response has mathematical inconsistencies! Attempting to fix...');
        
        // If AI made mistakes, try to correct them
        if (totalReference !== referenceCheck) {
          console.warn(`Reference mismatch: ${totalReference} vs ${referenceCheck}`);
        }
        if (totalInspection !== inspectionCheck) {
          console.warn(`Inspection mismatch: ${totalInspection} vs ${inspectionCheck}`);
        }
      }
      console.log('================================');

      // Post-process to catch only truly identical or very similar items
      let correctedMissingItems: string[] = [];
      let correctedCommonItems = [...commonItems];

      // If identical content detected, force 100% common
      if (isDefinitelyIdentical) {
        console.log('🚨 IDENTICAL CONTENT DETECTED - FORCING 100% COMMON 🚨');
        correctedMissingItems = [];
        correctedCommonItems = [...filteredReferenceItems];
        console.log('All items moved to COMMON, MISSING and NEW set to 0');
      } else {
        // Normal post-processing for non-identical content
        for (const missingItem of missingItems) {
          // Check if this "missing" item might actually exist in inspection items
          const hasSimilarItem = filteredInspectionItems.some(inspItem => {
            const missingLower = missingItem.toLowerCase();
            const inspLower = inspItem.toLowerCase();
            
            // Check for exact or very close matches
            if (missingLower === inspLower) return true;
            
            // Check for minor variations (same object, different description)
            const missingWords = missingLower.split(/\s+/).filter((word: string) => word.length > 2);
            const inspWords = inspLower.split(/\s+/).filter((word: string) => word.length > 2);
            
            // Count matching significant words
            const matchingWords = missingWords.filter((word: string) => 
              inspWords.some((inspWord: string) => 
                word === inspWord || 
                (word.length > 4 && inspWord.length > 4 && 
                 (word.includes(inspWord) || inspWord.includes(word)))
              )
            );
            
            // Require at least 2 matching significant words for similarity
            const similarityScore = matchingWords.length / Math.max(missingWords.length, inspWords.length);
            
            // Only consider similar if similarity is high (same object, different description)
            return similarityScore >= 0.6;
          });

          if (hasSimilarItem) {
            console.log(`⚠️ Correcting "${missingItem}" from MISSING to COMMON (found similar item)`);
            correctedCommonItems.push(missingItem);
          } else {
            correctedMissingItems.push(missingItem);
          }
        }
      }

      // Use corrected results
      let finalMissingItems = correctedMissingItems;
      let finalCommonItems = correctedCommonItems;

      // Final mathematical validation
      const finalReferenceCheck = finalCommonItems.length + finalMissingItems.length;
      const finalInspectionCheck = finalCommonItems.length + newItems.length;
      
      console.log('=== FINAL VALIDATION ===');
      console.log(`Final Reference: ${finalCommonItems.length} + ${finalMissingItems.length} = ${finalReferenceCheck} (should be ${filteredReferenceItems.length})`);
      console.log(`Final Inspection: ${finalCommonItems.length} + ${newItems.length} = ${finalInspectionCheck} (should be ${filteredInspectionItems.length})`);
      
      // Special handling for identical content
      if (isDefinitelyIdentical) {
        console.log('🚨 IDENTICAL CONTENT - ENFORCING PERFECT MATCH 🚨');
        // Force all items to be common, no missing or new
        finalMissingItems = [];
        finalCommonItems = [...filteredReferenceItems];
        // Also clear new items for identical content
        newItems.length = 0;
        console.log('Forced identical content result: 100% common, 0 missing, 0 new');
      } else if (Math.abs(filteredReferenceItems.length - finalReferenceCheck) > 1) {
        console.warn('⚠️ Forcing mathematical correction...');
        // Move some missing items to common if they have similar matches
        const forceCorrectedMissing = finalMissingItems.slice(0, Math.max(0, filteredReferenceItems.length - finalCommonItems.length));
        const forceCorrectedCommon = [...finalCommonItems, ...finalMissingItems.slice(Math.max(0, filteredReferenceItems.length - finalCommonItems.length))];
        
        console.log('Force corrected missing items:', forceCorrectedMissing);
        console.log('Force corrected common items:', forceCorrectedCommon);
        
        // Use force corrected results
        finalMissingItems = forceCorrectedMissing;
        finalCommonItems = forceCorrectedCommon;
      }
      console.log('========================');

      // Helper function to group and count items
      const groupAndCountItems = (items: string[]): Array<{ item: string; count: number }> => {
        const itemCounts: { [key: string]: number } = {};
        
        items.forEach(item => {
          const normalizedItem = item.toLowerCase().replace(/\s+/g, ' ').trim();
          if (itemCounts[normalizedItem]) {
            itemCounts[normalizedItem]++;
          } else {
            itemCounts[normalizedItem] = 1;
          }
        });
        
        return Object.entries(itemCounts).map(([item, count]) => ({
          item: item.charAt(0).toUpperCase() + item.slice(1),
          count
        }));
      };

      const groupedMissingItems = groupAndCountItems(finalMissingItems);
      const groupedNewItems = groupAndCountItems(newItems);
      const groupedCommonItems = groupAndCountItems(finalCommonItems);

      console.log('=== FINAL RESULTS ===');
      console.log(`Missing Items (${finalMissingItems.length}):`, finalMissingItems);
      console.log(`New Items (${newItems.length}):`, newItems);
      console.log(`Common Items (${finalCommonItems.length}):`, finalCommonItems);
      console.log('==================');

      return {
        missingItems: finalMissingItems,
        newItems,
        commonItems: finalCommonItems,
        inspectionItems: filteredInspectionItems,
        referenceItems: filteredReferenceItems,
        missingItemsCount: finalMissingItems.length,
        newItemsCount: newItems.length,
        commonItemsCount: finalCommonItems.length,
        totalReferenceItems: filteredReferenceItems.length,
        totalInspectionItems: filteredInspectionItems.length,
        groupedMissingItems,
        groupedNewItems,
        groupedCommonItems
      };

         } catch (error) {
       console.error('AI comparison failed, falling back to frontend logic:', error);
       
       // Fallback to simple frontend comparison if AI fails
       const missingItems = [...referenceItems];
       const newItems = [...inspectionItems];
       const commonItems: string[] = [];

       // Helper function for fallback
       const groupAndCountItems = (items: string[]): Array<{ item: string; count: number }> => {
         const itemCounts: { [key: string]: number } = {};
         
         items.forEach(item => {
           const normalizedItem = item.toLowerCase().replace(/\s+/g, ' ').trim();
           if (itemCounts[normalizedItem]) {
             itemCounts[normalizedItem]++;
           } else {
             itemCounts[normalizedItem] = 1;
           }
         });
         
         return Object.entries(itemCounts).map(([item, count]) => ({
           item: item.charAt(0).toUpperCase() + item.slice(1),
           count
         }));
       };

       const groupedMissingItems = groupAndCountItems(missingItems);
       const groupedNewItems = groupAndCountItems(newItems);
       const groupedCommonItems = groupAndCountItems(commonItems);

      return {
        missingItems,
        newItems,
        commonItems,
        inspectionItems,
        referenceItems,
        missingItemsCount: missingItems.length,
        newItemsCount: newItems.length,
        commonItemsCount: commonItems.length,
        totalReferenceItems: referenceItems.length,
        totalInspectionItems: inspectionItems.length,
        groupedMissingItems,
        groupedNewItems,
        groupedCommonItems
      };
    }
  };

  // Analyze the inspection video
  const analyzeInspectionVideo = async () => {
    if (!inspectionFile || !selectedRoomVideo) return;
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setError(null);
    
    try {
      // Step 1: Extract frames from the video
      setAnalysisProgress(20);
      const frameBlobs = await extractFramesFromVideo(inspectionFile, 2); // Extract frames every 2 seconds
      
      // Convert blobs to data URLs
      const frames = await Promise.all(
        frameBlobs.map(blob => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }))
      );
      
      // Step 2: Call OpenAI to analyze the frames
      setAnalysisProgress(40);
      const detectedItems = await analyzeFramesWithOpenAI(frames, selectedRoomVideo.items || []);
      
      // Step 3: Compare with reference video items using AI
      setAnalysisProgress(60);
      const referenceItems = selectedRoomVideo.items || [];
      const comparison = await compareItemsWithAI(referenceItems, detectedItems);
      
      setAnalysisProgress(80);
      setComparisonResult(comparison);
      
      // Step 4: Save the analysis results to Firebase
      setAnalysisProgress(90);
      if (!roomId) throw new Error('Room ID is required');
      const videoUrl = inspectionVideo || 'inspection-video';
      const analysisId = await createVideoAnalysis(roomId, videoUrl);
      await updateVideoAnalysisResults(
        analysisId,
        detectedItems,
        comparison.missingItems,
        URL.createObjectURL(inspectionFile)
      );
      
      setAnalysisProgress(100);
      
    } catch (err) {
      setError('Failed to analyze video. Please try again.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  // Generate and download PDF report
  const downloadReport = async () => {
    if (!comparisonResult || !room || !home) return;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const marginLeft = 15;
      const lineHeight = 7;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const safeWidth = pageWidth - marginLeft * 2;

      let cursorY = 15;

      const addTitle = (text: string) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text(text, marginLeft, cursorY);
        cursorY += lineHeight + 2;
      };

      const addSubTitle = (text: string) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.text(text, marginLeft, cursorY);
        cursorY += lineHeight;
      };

      const addSectionHeader = (text: string) => {
        cursorY += 2;
        pdf.setDrawColor(230);
        pdf.setFillColor(245, 247, 250);
        pdf.rect(marginLeft, cursorY, safeWidth, lineHeight + 3, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(31, 41, 55);
        pdf.text(text, marginLeft + 2, cursorY + lineHeight);
        pdf.setTextColor(0, 0, 0);
        cursorY += lineHeight + 6;
      };

      const ensureSpace = (needed: number) => {
        const pageHeight = pdf.internal.pageSize.getHeight();
        if (cursorY + needed > pageHeight - 15) {
          pdf.addPage();
          cursorY = 15;
        }
      };

      const addKeyValue = (key: string, value: string) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        const keyText = `${key}: `;
        const keyWidth = pdf.getTextWidth(keyText);
        pdf.text(keyText, marginLeft, cursorY);

        pdf.setFont('helvetica', 'normal');
        const wrappedValue = pdf.splitTextToSize(value || '-', safeWidth - keyWidth - 2);
        pdf.text(wrappedValue, marginLeft + keyWidth, cursorY);
        cursorY += Math.max(lineHeight, wrappedValue.length * (lineHeight - 1));
      };

      const addBulletList = (items: string[], color: [number, number, number]) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(color[0], color[1], color[2]);
        for (const item of items) {
          const wrapped = pdf.splitTextToSize(`• ${item}`, safeWidth);
          ensureSpace(wrapped.length * (lineHeight - 1) + 2);
          pdf.text(wrapped, marginLeft, cursorY);
          cursorY += wrapped.length * (lineHeight - 1);
        }
        pdf.setTextColor(0, 0, 0);
      };

      // Header
      addTitle('Room Inspection Report');
      addSubTitle(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`);

      // Room Information
      addSectionHeader('Room Information');
      ensureSpace(3 * lineHeight + 10);
      addKeyValue('Room Name', room.name);
      addKeyValue('Home', home.name);
      addKeyValue('Description', room.description || '-');

      // Summary
      addSectionHeader('Inspection Summary');
      ensureSpace(4 * lineHeight + 10);
      addKeyValue('Missing Items', String(comparisonResult.missingItemsCount));
      addKeyValue('New Items', String(comparisonResult.newItemsCount));
      addKeyValue('Common Items', String(comparisonResult.commonItemsCount));
      addKeyValue('Total Items', String(comparisonResult.totalInspectionItems));

      // Detailed Sections
      addSectionHeader(`Missing Items (${comparisonResult.missingItemsCount})`);
      if (comparisonResult.groupedMissingItems.length === 0) {
        ensureSpace(lineHeight);
        pdf.text('No missing items found. All reference items are present.', marginLeft, cursorY);
        cursorY += lineHeight;
      } else {
        // Add grouped missing items with counts
        comparisonResult.groupedMissingItems.forEach(itemData => {
          const itemText = itemData.count > 1 ? `${itemData.item} × ${itemData.count}` : itemData.item;
          pdf.text(`• ${itemText}`, marginLeft, cursorY);
          cursorY += lineHeight;
        });
      }

      addSectionHeader(`New Items (${comparisonResult.newItemsCount})`);
      if (comparisonResult.groupedNewItems.length === 0) {
        ensureSpace(lineHeight);
        pdf.text('No new items found in the inspection.', marginLeft, cursorY);
        cursorY += lineHeight;
      } else {
        // Add grouped new items with counts
        comparisonResult.groupedNewItems.forEach(itemData => {
          const itemText = itemData.count > 1 ? `${itemData.item} × ${itemData.count}` : itemData.item;
          pdf.text(`• ${itemText}`, marginLeft, cursorY);
          cursorY += lineHeight;
        });
      }

      addSectionHeader(`Common Items (${comparisonResult.commonItemsCount})`);
      if (comparisonResult.groupedCommonItems.length === 0) {
        ensureSpace(lineHeight);
        pdf.text('No common items found between the reference and inspection.', marginLeft, cursorY);
        cursorY += lineHeight;
      } else {
        // Add grouped common items with counts
        comparisonResult.groupedCommonItems.forEach(itemData => {
          const itemText = itemData.count > 1 ? `${itemData.item} × ${itemData.count}` : itemData.item;
          pdf.text(`• ${itemText}`, marginLeft, cursorY);
          cursorY += lineHeight;
        });
      }

      // Footer
      ensureSpace(lineHeight * 2);
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text('This report was generated automatically by the HomeFinder Room Inspection System.', marginLeft, cursorY);

      const fileName = `inspection-report-${room.name}-${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF report. Please try again.');
    }
  };

  // Clear the current inspection
  const clearInspection = () => {
    console.log('Clearing inspection video...');
    setInspectionVideo(null);
    setInspectionFile(null);
    setComparisonResult(null);
    setAnalysisProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Ensure reference video is not affected
    if (videoRef.current && videoRef.current.src) {
      console.log('Reference video has source, keeping it intact');
    }
    
    // Reset camera ready state
    setCameraReady(false);
    
    // Clean up any recording sections and live preview videos
    const recordingSections = document.querySelectorAll('[data-recording-section]');
    const livePreviewVideos = document.querySelectorAll('[data-live-preview="true"]');
    
    if (recordingSections.length > 0) {
      console.log('Cleaning up recording sections during clear...');
      recordingSections.forEach(section => section.remove());
      console.log('Recording sections removed during clear');
    }
    
    if (livePreviewVideos.length > 0) {
      console.log('Cleaning up live preview videos during clear...');
      livePreviewVideos.forEach(video => video.remove());
      console.log('Live preview videos removed during clear');
    }
    
    // Reset the live preview ref
    livePreviewRef.current = null;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state - only show for critical errors, not authentication issues
  if (error && error !== 'Failed to load room data') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 text-lg">{error}</p>
          <Button 
            onClick={() => navigate(`/homes/${homeId}`)}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Room not found - continue for public access
  if (!room && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Room not found</h2>
          <p className="text-gray-500 mb-4">This room may require authentication to access.</p>
          <Button onClick={() => navigate(`/homes/${homeId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div className="flex items-center mb-4 md:mb-0">
            <Button 
              variant="ghost" 
              onClick={() => navigate(`/homes/${homeId}`)}
              className="mr-4"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Room Inspection</h1>
              <p className="text-gray-600 dark:text-gray-400">
                {room?.name || 'Room'} • {home?.name || 'Home'}
              </p>
            </div>
          </div>
          
          {selectedRoomVideo && (
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Comparing with analysis from {new Date(selectedRoomVideo.completedAt?.toDate()).toLocaleDateString()}
              </p>
            </div>
          )}
          
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reference Video */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden" data-reference-section="true">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold">Reference Video</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {room ? 'Select a reference video to compare against' : 'Sign in to access reference videos'}
                </p>
              </div>
              
              <div className="p-4">
                {availableReferenceVideos.length > 0 ? (
                  <div className="space-y-4">
                    {availableReferenceVideos.map((video) => (
                      <div 
                        key={video.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedRoomVideo?.id === video.id 
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                        onClick={() => {
                          setSelectedRoomVideo(video);
                        }}
                      >
                        <div className="flex items-center mb-2">
                          <Video className="w-5 h-5 text-blue-500 mr-3" />
                          <div className="flex-1">
                            <p className="font-medium">
                              {new Date(video.completedAt?.toDate()).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {video.items?.length || 0} items detected
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Room ID: {video.roomId}
                            </p>
                          </div>
                        </div>
                        
                        {/* Video Preview */}
                        {selectedRoomVideo?.id === video.id && video.cloudinaryUrl && (
                          <div className="mt-3">
                            <video
                              src={video.cloudinaryUrl}
                              className="w-full h-32 rounded-lg"
                              controls
                              preload="metadata"
                              playsInline
                              onLoadedMetadata={(e) => {
                                const videoElement = e.currentTarget;
                                console.log('Video metadata loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                                // Set mobile-specific attributes programmatically
                                videoElement.setAttribute('webkit-playsinline', 'true');
                                videoElement.setAttribute('x5-playsinline', 'true');
                                videoElement.setAttribute('x5-video-player-type', 'h5');
                                videoElement.setAttribute('x5-video-player-fullscreen', 'true');
                              }}
                              onCanPlay={(e) => {
                                const videoElement = e.currentTarget;
                                console.log('Video can play:', videoElement.readyState);
                              }}
                              onError={(e) => {
                                console.error('Video error:', e.currentTarget.error);
                              }}
                              onClick={(e) => {
                                const videoElement = e.currentTarget;
                                playVideoOnMobile(videoElement);
                              }}
                              onTouchStart={(e) => {
                                const videoElement = e.currentTarget;
                                playVideoOnMobile(videoElement);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Video className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {room ? 'No reference videos available for this room. Please analyze a video first.' : 'Sign in to access reference videos for this room.'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      Room ID: {roomId}
                    </p>
                    {!room && (
                      <Button 
                        onClick={() => navigate('/login')}
                        className="mt-4"
                        variant="outline"
                      >
                        Sign In
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inspection Video */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden" data-inspection-section="true">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold">Inspection Video</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Record a new video or upload an existing one
                </p>
              </div>

              <div className="p-4">
                                {/* Show live preview during recording */}
                {isRecording && (
                  <div className="space-y-4">
                    {/* <video
                      ref={livePreviewRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full rounded-lg"
                      style={{ transform: 'scaleX(-1)' }}
                      onLoadedMetadata={() => {
                        console.log('Live video metadata loaded');
                        setCameraReady(true);
                      }}
                      onCanPlay={() => {
                        console.log('Live video can play');
                        setCameraReady(true);
                      }}
                      onPlay={() => {
                        console.log('Live video playing');
                        setCameraReady(true);
                      }}
                      onError={(e) => {
                        console.error('Live video error:', e);
                        setCameraReady(false);
                      }}
                    /> */}
                    
                    <div className="flex justify-center gap-3">
                        <Button 
                          variant="destructive"
                          onClick={stopRecording}
                          size="lg"
                        >
                          <div className="w-4 h-4 bg-white rounded-full mr-2"></div>
                          Stop Recording
                        </Button>
                        
                        {/* Mobile camera switch button */}
                        <Button 
                          variant="outline"
                          onClick={switchCamera}
                          size="lg"
                          className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Switch to {currentCameraMode === 'user' ? 'Back' : 'Front'}
                        </Button>
                        
                        {!cameraReady && (
                          <Button 
                            variant="outline"
                            onClick={() => {
                              console.log('Manual camera start clicked...');
                              if (livePreviewRef.current && mediaRecorderRef.current?.stream) {
                                const stream = mediaRecorderRef.current.stream;
                                livePreviewRef.current.srcObject = stream;
                                livePreviewRef.current.play().then(() => {
                                  console.log('Manual camera start successful');
                                  setCameraReady(true);
                                }).catch(console.error);
                              }
                            }}
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Start Camera
                          </Button>
                        )}
                      </div>
                    </div>
                )}
                
                {/* Show recorded video after recording */}
                {inspectionVideo && !isRecording ? (
                  <div className="space-y-4">
                    <video
                      ref={videoRef}
                      src={inspectionVideo}
                      className="w-full rounded-lg"
                              controls
                              preload="metadata"
                              playsInline
                              onLoadedMetadata={(e) => {
                                const videoElement = e.currentTarget;
                                console.log('Video metadata loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                                // Set mobile-specific attributes programmatically
                                videoElement.setAttribute('webkit-playsinline', 'true');
                                videoElement.setAttribute('x5-playsinline', 'true');
                                videoElement.setAttribute('x5-video-player-type', 'h5');
                                videoElement.setAttribute('x5-video-player-fullscreen', 'true');
                              }}
                              onCanPlay={(e) => {
                                const videoElement = e.currentTarget;
                                console.log('Video can play:', videoElement.readyState);
                              }}
                              onError={(e) => {
                                console.error('Video error:', e.currentTarget.error);
                              }}
                              onClick={(e) => {
                                const videoElement = e.currentTarget;
                                playVideoOnMobile(videoElement);
                              }}
                              onTouchStart={(e) => {
                                const videoElement = e.currentTarget;
                                playVideoOnMobile(videoElement);
                              }}

                      data-video-type="recorded"
                    />
                    
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        variant="outline" 
                        onClick={clearInspection}
                        disabled={isAnalyzing}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear
                      </Button>
                      
                      <Button 
                        onClick={analyzeInspectionVideo}
                        disabled={!selectedRoomVideo || isAnalyzing || !room}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isAnalyzing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                            Analyzing... {analysisProgress}%
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4 mr-2" />
                            Analyze Video
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : !isRecording && !inspectionVideo ? (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <Video className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-medium">Record or upload a video</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                        Record a new video using your camera or upload an existing video file
                      </p>
                      
                      <div className="flex flex-wrap justify-center gap-3 mt-4">
                        <Button 
                          variant="outline"
                          onClick={startRecording}
                          disabled={isRecording}
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          {isRecording ? 'Recording...' : 'Record Video'}
                        </Button>
                        
                        {isRecording && (
                          <div className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                            Camera is active - recording preview should be visible above
                          </div>
                        )}
                        
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="video/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="video-upload"
                        />
                        <Button 
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Video
                        </Button>
                      </div>
                      
                      {isRecording && (
                        <Button 
                          variant="destructive"
                          onClick={stopRecording}
                          className="mt-2"
                        >
                          <div className="w-3 h-3 bg-white rounded-full mr-2"></div>
                          Stop Recording
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {comparisonResult && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Inspection Results</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Comparison between reference and inspection videos
              </p>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-100 dark:border-red-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">Missing Items</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">{comparisonResult.missingItemsCount}</p>
                  </div>
                  <X className="w-8 h-8 text-red-500" />
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-100 dark:border-yellow-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">New Items</p>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{comparisonResult.newItemsCount}</p>
                  </div>
                  <Plus className="w-8 h-8 text-yellow-500" />
                </div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-100 dark:border-green-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">Common Items</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{comparisonResult.commonItemsCount}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Items</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{comparisonResult.totalInspectionItems}</p>
                  </div>
                  <Search className="w-8 h-8 text-blue-500" />
                </div>
              </div>
            </div>
            
            {/* Detailed Results */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              {/* Missing Items */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-100 dark:border-red-900/30">
                <div className="flex items-center mb-3">
                  <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-full mr-3">
                    <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">
                    Missing Items ({comparisonResult.missingItemsCount})
                  </h3>
                </div>
                
                {comparisonResult.groupedMissingItems.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {comparisonResult.groupedMissingItems.map((itemData, index) => (
                      <li key={index} className="flex items-center justify-between text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 p-2 rounded">
                        <div className="flex items-center flex-1">
                          <X className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="break-words">{itemData.item}</span>
                        </div>
                        {itemData.count > 1 && (
                          <span className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded-full text-xs font-medium ml-2">
                            × {itemData.count}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-red-700/80 dark:text-red-300/80">
                    No missing items found. All reference items are present.
                  </p>
                )}
              </div>
              
              {/* New Items */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-100 dark:border-yellow-900/30">
                <div className="flex items-center mb-3">
                  <div className="bg-yellow-100 dark:bg-yellow-900/40 p-2 rounded-full mr-3">
                    <Plus className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    New Items ({comparisonResult.newItemsCount})
                  </h3>
                </div>
                
                {comparisonResult.groupedNewItems.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {comparisonResult.groupedNewItems.map((itemData, index) => (
                      <li key={index} className="flex items-center justify-between text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                        <div className="flex items-center flex-1">
                          <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="break-words">{itemData.item}</span>
                        </div>
                        {itemData.count > 1 && (
                          <span className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full text-xs font-medium ml-2">
                            × {itemData.count}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-yellow-700/80 dark:text-yellow-300/80">
                    No new items found in the inspection.
                  </p>
                )}
              </div>
              
              {/* Common Items */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-100 dark:border-green-900/30">
                <div className="flex items-center mb-3">
                  <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-full mr-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-green-800 dark:text-green-200">
                    Common Items ({comparisonResult.commonItemsCount})
                  </h3>
                </div>
                
                {comparisonResult.groupedCommonItems.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {comparisonResult.groupedCommonItems.map((itemData, index) => (
                      <li key={index} className="flex items-center justify-between text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 p-2 rounded">
                        <div className="flex items-center flex-1">
                          <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="break-words">{itemData.item}</span>
                        </div>
                        {itemData.count > 1 && (
                          <span className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium ml-2">
                            × {itemData.count}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-green-700/80 dark:text-green-300/80">
                    No common items found between the reference and inspection.
                  </p>
                )}
              </div>
            </div>
            
            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between">
                <div>
                  <h4 className="font-medium">Inspection Summary</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {comparisonResult.missingItemsCount} missing • {comparisonResult.newItemsCount} new • {comparisonResult.commonItemsCount} matching
                  </p>
                  {comparisonResult.missingItemsCount > 0 && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      ⚠️ Attention: {comparisonResult.missingItemsCount} items from the reference video were not found in the inspection video.
                    </p>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadReport}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Report
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectionPage;