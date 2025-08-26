import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract frames from a video file at a much higher frequency for detailed analysis.
 * Returns an array of Blob images (JPEG) with high quality.
 */
export async function extractFramesFromVideo(videoFile: File, intervalSeconds = 0.5): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.currentTime = 0;

    const canvas = document.createElement('canvas');
    const frames: Blob[] = [];

    video.addEventListener('loadedmetadata', () => {
      const duration = video.duration;
      let currentTime = 0;
      const maxFrames = Math.min(50, Math.floor(duration / intervalSeconds)); // Limit to 50 frames max
      const actualInterval = duration / maxFrames; // Adjust interval to get optimal frame count

      console.log(`Video duration: ${duration}s, extracting ${maxFrames} frames every ${actualInterval.toFixed(2)}s`);

      function captureFrame() {
        video.currentTime = currentTime;
      }

      video.addEventListener('seeked', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Ensure high quality frame capture
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to high quality JPEG
        canvas.toBlob(blob => {
          if (blob) {
            frames.push(blob);
            console.log(`Captured frame at ${currentTime.toFixed(2)}s (${frames.length}/${maxFrames})`);
          }
          
          currentTime += actualInterval;
          if (currentTime < duration && frames.length < maxFrames) {
            captureFrame();
          } else {
            console.log(`Frame extraction complete: ${frames.length} frames captured`);
            resolve(frames);
          }
        }, 'image/jpeg', 0.95); // High quality JPEG
      });

      captureFrame();
    });

    video.onerror = reject;
  });
}
