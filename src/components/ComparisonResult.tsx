import React from 'react';
import { motion } from 'framer-motion';
import {
  Image,
  CheckCircle,
  AlertCircle,
  Diff,
  Clock,
  Eye,
  Download,
  Share2
} from 'lucide-react';

interface ComparisonResultProps {
  results: string;
  referenceImage?: string | null;
  comparisonImage?: string | null;
  isLoggedIn?: boolean;
}

export const ComparisonResult: React.FC<ComparisonResultProps> = ({
  results,
  referenceImage,
  comparisonImage,
  isLoggedIn = false
}) => {
  if (!results) {
    return null;
  }

  // Parse the results to extract differences
  const parseResults = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const differences: string[] = [];

    lines.forEach(line => {
      if (line.includes('-') || line.includes('•') || line.includes('*')) {
        const diff = line.replace(/^[-•*]\s*/, '').trim();
        if (diff) differences.push(diff);
      } else if (line.match(/^\d+\./)) {
        const diff = line.replace(/^\d+\.\s*/, '').trim();
        if (diff) differences.push(diff);
      } else if (line.trim() && line.toLowerCase().includes('difference')) {
        differences.push(line.trim());
      }
    });

    return differences.length > 0 ? differences : [text];
  };

  const detectedDifferences = parseResults(results);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <div className="flex items-center space-x-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"
          >
            <Diff className="w-6 h-6" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold">Image Comparison Results</h2>
            <p className="text-indigo-100">Differences detected between images</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Image Comparison */}
        {(referenceImage || comparisonImage) && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Image Comparison
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {referenceImage && (
                <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    src={referenceImage}
                    alt="Reference image"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                    Reference
                  </div>
                </div>
              )}
              {comparisonImage && (
                <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    src={comparisonImage}
                    alt="Comparison image"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                    Comparison
                  </div>
                </div>
              )}
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
              <Diff className="w-5 h-5 mr-2" />
              Detected Differences ({detectedDifferences.length})
            </h3>
            <div className="flex space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Download Results"
              >
                <Download className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Share Results"
              >
                <Share2 className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Differences List */}
          <div className="space-y-3">
            {detectedDifferences.map((difference, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.1, type: "spring", stiffness: 200 }}
                  className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                >
                  <AlertCircle className="w-4 h-4 text-white" />
                </motion.div>
                <span className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  {difference}
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
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center space-x-2">
                <Diff className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                  Total Differences
                </span>
              </div>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">
                {detectedDifferences.length}
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-800 dark:text-red-200">
                  Detected
                </span>
              </div>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                {detectedDifferences.length}
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
                ~3s
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