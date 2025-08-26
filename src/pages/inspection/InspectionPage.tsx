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
          
          // Get analyses for each room video
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
          text: `You are an expert room inspector with exceptional attention to detail. Your task is to analyze these video frames and list EVERY visible item with maximum precision.

CRITICAL INSTRUCTIONS FOR MAXIMUM DETAIL:
- List EVERY single item you can see, no matter how small or seemingly insignificant
- Include specific details: exact colors, materials, sizes, locations, quantities, patterns
- Be extremely thorough - don't miss any objects, furniture, decorative items, or details
- Consider items in: corners, on surfaces, hanging, placed around, partially visible, in shadows
- Look for: clothing items, accessories, electronics, books, papers, containers, plants, artwork
- Pay attention to: wall decorations, floor items, table surfaces, shelves, drawers, beds, chairs
- Be precise about: exact locations, orientations, conditions, brands, styles
- Count multiple items: "3 white cups on counter", "2 black chairs at table"

Reference items from previous analysis (for context): ${referenceItems.join(', ')}

Format your response as a numbered list with each item on a separate line. Be extremely detailed and thorough.`
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

      // Create balanced prompt for AI to accurately categorize items without over-aggression
      const prompt = `You are an expert room inspector with PERFECT accuracy. You are comparing a reference video with an inspection video to accurately categorize items.

${isLikelyIdentical ? '⚠️ NOTE: This appears to be similar content. Be accurate in categorization. ⚠️' : ''}

REFERENCE VIDEO ITEMS (original room state):
${filteredReferenceItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

INSPECTION VIDEO ITEMS (current room state):
${filteredInspectionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

ACCURATE CATEGORIZATION RULES:

1. COMMON ITEMS - items that are the SAME physical object:
   - Must be the exact same object, not just similar types
   - Examples of what IS common:
     * "black shirt on bed" vs "black shirt on bed" = COMMON (identical)
     * "cup on table" vs "cup on table" = COMMON (identical)
     * "lamp on side table" vs "lamp on side table" = COMMON (identical)
   - Examples of what is NOT common (different objects):
     * "black shirt on bed" vs "red shirt on chair" = NOT COMMON (different objects)
     * "coffee mug on table" vs "water glass on counter" = NOT COMMON (different objects)
     * "lamp on side table" vs "floor lamp in corner" = NOT COMMON (different objects)

2. MISSING ITEMS - items from reference that are NOT in inspection:
   - Item must be completely absent from inspection
   - Examples:
     * "black shirt on bed" in reference, no shirts in inspection = MISSING
     * "coffee mug on table" in reference, no cups/mugs in inspection = MISSING

3. NEW ITEMS - items in inspection that were NOT in reference:
   - Must be completely new objects
   - Examples:
     * "red book on shelf" in inspection, no books in reference = NEW
     * "blue vase on table" in inspection, no vases in reference = NEW

PRECISION REQUIREMENTS:
- Be EXACT in your categorization
- Don't assume items are the same just because they're similar types
- Each item should be in exactly one category
- When in doubt, categorize based on exact descriptions, not assumptions

Respond with ONLY this JSON structure (no other text):
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

      // Post-process to catch only truly identical or very similar items
      const correctedMissingItems: string[] = [];
      const correctedCommonItems = [...commonItems];

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

      // Use corrected results
      const finalMissingItems = correctedMissingItems;
      const finalCommonItems = correctedCommonItems;

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
                              className="w-full h-32 object-cover rounded-lg"
                              controls
                              preload="metadata"
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
                      No reference videos available for this room. Please analyze a video first.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      Room ID: {roomId}
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