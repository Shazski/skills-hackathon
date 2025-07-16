import React, { useState, useRef, useEffect } from "react";
import { VideoUploader } from "../../components/VideoUploader";
import { VideoAnalysisResult } from "../../components/VideoAnalysisResult";
import { motion } from "framer-motion";
import {
  Video,
  Brain,
  Sparkles,
  Upload as UploadIcon,
  Play,
  Zap,
  Save,
  Cloud
} from "lucide-react";
import { useLoader } from '@/App';
import { withLoader } from '@/lib/firebaseService';

export default function VideoAnalysisPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null);
  const [results, setResults] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isLoggedIn = false; // Replace with real auth logic
  const canAnalyze = videoFile;

  const resultsRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showResults && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showResults]);

  const handleVideoChange = (file: File | null, url: string | null) => {
    setVideoFile(file);
    setVideoUrl(url);
    setCloudinaryUrl(null);
    setResults("");
    setShowResults(false);
    setUploadProgress(0);
    // Scroll to bottom after upload/record
    setTimeout(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default');
    formData.append('cloud_name', import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name'}/video/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload to Cloudinary');
    }

    const data = await response.json();
    return data.secure_url;
  };

  const handleSaveAndAnalyze = async () => {
    if (!videoFile) return;

    setLoading(true);
    setShowResults(false);
    setUploadProgress(0);

    try {
      // Step 1: Upload to Cloudinary (0-50%)
      console.log('Uploading to Cloudinary...');
      setUploadProgress(10);

      const cloudinaryVideoUrl = await withLoader(() => uploadToCloudinary(videoFile));
      setCloudinaryUrl(cloudinaryVideoUrl);
      setUploadProgress(50);

      console.log('Cloudinary upload complete:', cloudinaryVideoUrl);

      // Step 2: Analyze with OpenAI (50-100%)
      console.log('Analyzing with OpenAI...');
      setUploadProgress(60);

      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o", // Using GPT-4o for better video analysis
          messages: [
            {
              role: "system",
              content: `You are an expert at analyzing video content and identifying objects, items, and elements present in videos. 
              
              Your task is to watch the provided video and create a comprehensive list of all visible items, objects, furniture, appliances, decorations, and any other notable elements you can identify.
              
              Please provide your response in the following format:
              - List each item on a separate line
              - Be specific and descriptive
              - Include furniture, electronics, decorations, appliances, etc.
              - Mention the approximate location or context if relevant
              - Focus on items that would be important for real estate or home analysis
              
              Format your response as a clean list with each item clearly described.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Please analyze this video and list all the items, furniture, appliances, and objects you can see. Focus on items that would be relevant for a home or room analysis."
                },
                {
                  type: "video_url",
                  video_url: {
                    url: cloudinaryVideoUrl
                  }
                }
              ],
            },
          ],
          max_tokens: 1000,
        }),
      });

      setUploadProgress(80);

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      setUploadProgress(90);

      const analysisResult = data.choices?.[0]?.message?.content || "No items detected in the video.";
      setResults(analysisResult);

      setUploadProgress(100);

      // Small delay to show 100% completion
      await new Promise(resolve => setTimeout(resolve, 500));

      setShowResults(true);
      console.log('Analysis complete');

    } catch (err) {
      console.error("Error in save and analyze:", err);
      setResults("Error analyzing video. Please try again.");
      setShowResults(true);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-12 px-4 md:px-0 flex flex-col items-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg"
        >
          <Video className="w-10 h-10 text-white" />
        </motion.div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 text-center">
          Video Analysis Tool
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-center max-w-2xl text-lg leading-relaxed">
          Upload a video, save it to the cloud, and let our AI analyze the content to identify all items, furniture, and objects present in your space.
        </p>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-4xl space-y-8">
          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Upload Your Video
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Select a video file to upload to the cloud and analyze the items within
              </p>
            </div>

            <VideoUploader
              label=""
              preview={videoUrl}
              onVideoChange={handleVideoChange}
              className="max-w-2xl mx-auto"
            />

            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.button
                disabled={!canAnalyze || loading}
                onClick={handleSaveAndAnalyze}
                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-3 mx-auto ${canAnalyze
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  }`}
                whileHover={canAnalyze ? { scale: 1.05 } : {}}
                whileTap={canAnalyze ? { scale: 0.95 } : {}}
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                    <span>Processing... {uploadProgress}%</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save & Analyze</span>
                  </>
                )}
              </motion.button>
            </motion.div>

            {/* Progress Bar */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 max-w-2xl mx-auto"
              >
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
                  <span>Uploading to Cloudinary...</span>
                  <span>{uploadProgress}%</span>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Features Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4">
                <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Cloud Storage
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Videos are securely uploaded to Cloudinary before analysis
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                AI-Powered Analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Advanced AI technology identifies all objects and items in your video
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Fast Processing
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Get detailed analysis results in seconds with optimized processing
              </p>
            </motion.div>
          </motion.div>

          {/* Results Section */}
          {showResults && (
            <motion.div
              ref={resultsRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <VideoAnalysisResult
                results={results}
                videoUrl={cloudinaryUrl || videoUrl}
                isLoggedIn={isLoggedIn}
                loading={loading}
              />
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm"
      >
        <p>&copy; {new Date().getFullYear()} Video Analysis Tool - Powered by AI & Cloudinary</p>
      </motion.footer>
    </div>
  );
} 