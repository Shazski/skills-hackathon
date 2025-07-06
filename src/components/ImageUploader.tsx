import React, { useState, useRef } from 'react';
import { Upload, X, Image, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImageUploaderProps {
  label: string;
  onImageChange: (file: File | null, url: string | null) => void;
  preview?: string | null;
  className?: string;
  roomId?: string;
  imageType?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  onImageChange,
  preview,
  className = '',
  roomId,
  imageType
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      onImageChange(file, url);
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
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      handleFileSelect(imageFile);
    }
  };

  const handleRemoveImage = () => {
    onImageChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />

        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Uploaded image"
              className="w-full h-48 object-cover rounded-lg bg-gray-100 dark:bg-gray-800"
            />

            {/* Remove button */}
            <motion.button
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        ) : (
          <motion.label
            htmlFor="image-upload"
            className="cursor-pointer flex flex-col items-center space-y-4"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Image className="w-8 h-8 text-gray-400" />
            </div>

            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">
                  Click to upload
                </span> or drag and drop
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                PNG, JPG, GIF up to 10MB
              </p>
            </div>
          </motion.label>
        )}
      </div>
    </div>
  );
}; 