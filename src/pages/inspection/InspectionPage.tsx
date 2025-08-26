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

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch room and reference videos data
  useEffect(() => {
    const fetchData = async () => {
      if (!homeId || !roomId) return;

      try {
        setLoading(true);
        const [homeData, roomsData] = await Promise.all([
          getHomeById(homeId),
          getRoomsByHomeId(homeId),
        ]);

        setHome(homeData);
        const currentRoom = roomsData.find((r) => r.id === roomId);
        setRoom(currentRoom || null);

        if (currentRoom) {
          const analyses = await getCompletedAnalysesByRoomId(roomId);
          setAvailableReferenceVideos(analyses);
          
          // Automatically select the most recent analysis if available
          if (analyses.length > 0) {
            setSelectedRoomVideo(analyses[0]);
          }
        }
      } catch (err) {
        setError('Failed to load room data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [homeId, roomId]);

  // Handle video recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setInspectionVideo(url);
        setInspectionFile(new File([blob], 'inspection.webm', { type: 'video/webm' }));
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
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
          text: `You are an expert at analyzing room content and identifying objects, furniture, and items. 

Your task is to analyze the provided video frames and create a comprehensive list of all visible items, objects, furniture, appliances, decorations, and any other notable elements you can identify.

IMPORTANT INSTRUCTIONS:
- List each item on a separate line
- Be specific and descriptive (e.g., "brown leather sofa" instead of just "sofa")
- Include furniture, electronics, decorations, appliances, etc.
- Mention the approximate location or context if relevant
- Focus on items that would be important for room inspection
- Count items if there are multiple of the same type (e.g., "2 dining chairs", "3 throw pillows")
- Be thorough and detailed in your analysis

Reference items from previous analysis (for context): ${referenceItems.join(', ')}

Format your response as a clean list with each item clearly described.`
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
          max_tokens: 1500,
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

      return items.length > 0 ? items : [analysisResult];
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  };

  // Enhanced comparison logic with item counting
  const compareItems = (referenceItems: string[], inspectionItems: string[]): ComparisonResult => {
    // Normalize items for better comparison
    const normalizeItem = (item: string) => item.toLowerCase().trim();
    
    const normalizedReference = referenceItems.map(normalizeItem);
    const normalizedInspection = inspectionItems.map(normalizeItem);
    
    // Count items
    const referenceItemCounts = new Map<string, number>();
    const inspectionItemCounts = new Map<string, number>();
    
    normalizedReference.forEach(item => {
      referenceItemCounts.set(item, (referenceItemCounts.get(item) || 0) + 1);
    });
    
    normalizedInspection.forEach(item => {
      inspectionItemCounts.set(item, (inspectionItemCounts.get(item) || 0) + 1);
    });
    
    // Find missing items (items in reference but not in inspection)
    const missingItems: string[] = [];
    referenceItemCounts.forEach((count, item) => {
      const inspectionCount = inspectionItemCounts.get(item) || 0;
      if (inspectionCount < count) {
        const missingCount = count - inspectionCount;
        if (missingCount === 1) {
          missingItems.push(item);
        } else {
          missingItems.push(`${item} (${missingCount} missing)`);
        }
      }
    });
    
    // Find new items (items in inspection but not in reference)
    const newItems: string[] = [];
    inspectionItemCounts.forEach((count, item) => {
      const referenceCount = referenceItemCounts.get(item) || 0;
      if (referenceCount < count) {
        const newCount = count - referenceCount;
        if (newCount === 1) {
          newItems.push(item);
        } else {
          newItems.push(`${item} (${newCount} additional)`);
        }
      }
    });
    
    // Find common items
    const commonItems: string[] = [];
    referenceItemCounts.forEach((count, item) => {
      const inspectionCount = inspectionItemCounts.get(item) || 0;
      if (inspectionCount > 0) {
        const commonCount = Math.min(count, inspectionCount);
        if (commonCount === 1) {
          commonItems.push(item);
        } else {
          commonItems.push(`${item} (${commonCount})`);
        }
      }
    });
    
    return {
      missingItems,
      newItems,
      commonItems,
      inspectionItems: inspectionItems,
      referenceItems: referenceItems,
      missingItemsCount: missingItems.length,
      newItemsCount: newItems.length,
      commonItemsCount: commonItems.length,
      totalReferenceItems: referenceItems.length,
      totalInspectionItems: inspectionItems.length
    };
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
      
      // Step 3: Compare with reference video items
      setAnalysisProgress(60);
      const referenceItems = selectedRoomVideo.items || [];
      const comparison = compareItems(referenceItems, detectedItems);
      
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
      addSectionHeader(`Missing Items (${comparisonResult.missingItems.length})`);
      if (comparisonResult.missingItems.length === 0) {
        ensureSpace(lineHeight);
        pdf.text('No missing items found. All reference items are present.', marginLeft, cursorY);
        cursorY += lineHeight;
      } else {
        addBulletList(comparisonResult.missingItems, [220, 38, 38]);
      }

      addSectionHeader(`New Items (${comparisonResult.newItems.length})`);
      if (comparisonResult.newItems.length === 0) {
        ensureSpace(lineHeight);
        pdf.text('No new items found in the inspection.', marginLeft, cursorY);
        cursorY += lineHeight;
      } else {
        addBulletList(comparisonResult.newItems, [217, 119, 6]);
      }

      addSectionHeader(`Common Items (${comparisonResult.commonItems.length})`);
      if (comparisonResult.commonItems.length === 0) {
        ensureSpace(lineHeight);
        pdf.text('No common items found between the reference and inspection.', marginLeft, cursorY);
        cursorY += lineHeight;
      } else {
        addBulletList(comparisonResult.commonItems, [22, 163, 74]);
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
    setInspectionVideo(null);
    setInspectionFile(null);
    setComparisonResult(null);
    setAnalysisProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
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

  // Room not found
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Room not found</h2>
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
                {room.name} • {home?.name}
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold">Reference Video</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select a reference video to compare against
                </p>
              </div>
              
              <div className="p-4">
                {availableReferenceVideos.length > 0 ? (
                  <div className="space-y-2">
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
                        <div className="flex items-center">
                          <Video className="w-5 h-5 text-blue-500 mr-3" />
                          <div>
                            <p className="font-medium">
                              {new Date(video.completedAt?.toDate()).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {video.items?.length || 0} items detected
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Video className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No reference videos available. Please analyze a video first.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inspection Video */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold">Inspection Video</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Record a new video or upload an existing one
                </p>
              </div>

              <div className="p-4">
                {inspectionVideo ? (
                  <div className="space-y-4">
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        src={inspectionVideo}
                        controls
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
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
                        disabled={!selectedRoomVideo || isAnalyzing}
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
                ) : (
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
                )}
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
                
                {comparisonResult.missingItems.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {comparisonResult.missingItems.map((item, index) => (
                      <li key={index} className="flex items-center text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 p-2 rounded">
                        <X className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="break-words">{item}</span>
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
                
                {comparisonResult.newItems.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {comparisonResult.newItems.map((item, index) => (
                      <li key={index} className="flex items-center text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                        <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="break-words">{item}</span>
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
                
                {comparisonResult.commonItems.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {comparisonResult.commonItems.map((item, index) => (
                      <li key={index} className="flex items-center text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 p-2 rounded">
                        <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="break-words">{item}</span>
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