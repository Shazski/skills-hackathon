import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract frames from a video file at a given interval (in seconds).
 * Returns an array of Blob images (JPEG).
 */
export async function extractFramesFromVideo(videoFile: File, intervalSeconds = 2): Promise<Blob[]> {
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

      function captureFrame() {
        video.currentTime = currentTime;
      }

      video.addEventListener('seeked', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) frames.push(blob);
          currentTime += intervalSeconds;
          if (currentTime < video.duration) {
            captureFrame();
          } else {
            resolve(frames);
          }
        }, 'image/jpeg');
      });

      captureFrame();
    });

    video.onerror = reject;
  });
}
