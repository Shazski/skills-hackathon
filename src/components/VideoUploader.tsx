import React, { useState, useRef } from 'react';
import { Upload, X, Video, Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';

interface VideoUploaderProps {
  label: string;
  onVideoChange: (file: File | null, url: string | null) => void;
  preview?: string | null;
  className?: string;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  label,
  onVideoChange,
  preview,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      onVideoChange(file, url);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));

    if (videoFile) {
      handleFileSelect(videoFile);
    }
  };

  const handleRemoveVideo = () => {
    onVideoChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${isDragOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleInputChange}
          className="hidden"
        />

        {preview ? (
          <div className="relative">
            <video
              ref={videoRef}
              src={preview}
              className="w-full h-48 object-cover rounded-lg bg-gray-100 dark:bg-gray-800"
              onEnded={handleVideoEnded}
            />

            {/* Play/Pause overlay */}
            <motion.button
              onClick={togglePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors rounded-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="bg-white/90 dark:bg-gray-800/90 rounded-full p-3">
                {isPlaying ? (
                  <Pause className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                ) : (
                  <Play className="w-6 h-6 text-gray-700 dark:text-gray-300 ml-1" />
                )}
              </div>
            </motion.button>

            {/* Remove button */}
            <motion.button
              onClick={handleRemoveVideo}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        ) : (
          <motion.label
            htmlFor="video-upload"
            className="cursor-pointer flex flex-col items-center space-y-4"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Video className="w-8 h-8 text-gray-400" />
            </div>

            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">
                  Click to upload
                </span> or drag and drop
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                MP4, WebM, MOV up to 100MB
              </p>
            </div>
          </motion.label>
        )}
      </div>
    </div>
  );
}; 