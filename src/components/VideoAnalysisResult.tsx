import React from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  CheckCircle,
  AlertCircle,
  Package,
  Clock,
  Eye,
  Download,
  Share2
} from 'lucide-react';

interface VideoAnalysisResultProps {
  results: string;
  videoUrl?: string | null;
  isLoggedIn?: boolean;
  loading?: boolean;
}

export const VideoAnalysisResult: React.FC<VideoAnalysisResultProps> = ({
  results,
  videoUrl,
  isLoggedIn = false,
  loading = false
}) => {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
      >
        <div className="flex items-center justify-center space-x-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"
          />
          <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Analyzing video content...
          </span>
        </div>
      </motion.div>
    );
  }

  if (!results) {
    return null;
  }

  // Parse the results to extract items (this is a simple parser, you might want to improve it)
  const parseResults = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const items: string[] = [];

    lines.forEach(line => {
      // Look for common patterns in AI responses
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

    return items.length > 0 ? items : [text];
  };

  const detectedItems = parseResults(results);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center space-x-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"
          >
            <Video className="w-6 h-6" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold">Video Analysis Results</h2>
            <p className="text-blue-100">Items detected in your video</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Video Preview */}
        {videoUrl && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Video Preview
            </h3>
            <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <video
                src={videoUrl}
                controls
                className="w-full h-48 object-cover"
              />
            </div>
          </motion.div>
        )}

        {/* Analysis Results */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Detected Items ({detectedItems.length})
            </h3>
            <div className="flex space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Download Results"
              >
                <Download className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Share Results"
              >
                <Share2 className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {detectedItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.1, type: "spring", stiffness: 200 }}
                  className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                >
                  <CheckCircle className="w-4 h-4 text-white" />
                </motion.div>
                <span className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  {item}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Summary Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Total Items
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                {detectedItems.length}
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Detected
                </span>
              </div>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                {detectedItems.length}
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  Analysis Time
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                ~5s
              </p>
            </div>
          </motion.div>

          {/* Login Prompt */}
          {!isLoggedIn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Sign in to save and compare analysis results
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}; 