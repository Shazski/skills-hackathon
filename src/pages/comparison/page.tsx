import React, { useState } from "react";
import { ImageUploader } from "../../components/ImageUploader";
import { ComparisonResult } from "../../components/ComparisonResult";
import { useLoader } from '@/App';
import { withLoader } from '@/lib/firebaseService';

export default function ComparisonPage() {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [comparisonFile, setComparisonFile] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [comparisonUrl, setComparisonUrl] = useState<string | null>(null);
  const [results, setResults] = useState("");
  const [loading, setLoading] = useState(false);

  const isLoggedIn = false;
  const canCompare = referenceFile && comparisonFile;

  const handleReferenceChange = (file: File | null, url: string | null) => {
    setReferenceFile(file);
    setReferenceUrl(url);
  };

  const handleComparisonChange = (file: File | null, url: string | null) => {
    setComparisonFile(file);
    setComparisonUrl(url);
  };

  const handleCompare = async () => {
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

      const res = await withLoader(() => fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4-turbo",
          messages: [
            {
              role: "system",
              content: `You are an expert at analyzing images and finding differences between them. 
          You will be given two images: a reference image and a comparison image. 
          Your task is to identify all the differences between these images and provide a detailed description of each difference.
          Focus on just Missing or added objects
          
          Format your response as a list of differences, with each difference clearly described.
          Be specific and detailed in your descriptions, mentioning the exact location and nature of each difference.`,
            },
            {
              role: "user",
              content:
                "Here are two almost identical images. The first is the reference image, and the second is the comparison image. Please identify and describe all the differences between them.",
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: referenceUrl },
                },
                {
                  type: "image_url",
                  image_url: { url: comparisonUrl },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      }));

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      setResults(
        data.choices?.[0]?.message?.content || "No differences detected."
      );
    } catch (err) {
      console.error("OpenAI request failed:", err);
      setResults("Error comparing images.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <header className="py-8 px-4 md:px-0 flex flex-col items-center">
        <h1 className="text-3xl md:text-4xl font-bold text-indigo-700 mb-2 text-center">
          Image Comparison Tool
        </h1>
        <p className="text-gray-600 text-center max-w-xl">
          Upload two images to compare them visually and see the differences.
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-2">
        <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-6 md:p-10 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ImageUploader
              label="Upload Reference Image"
              preview={referenceUrl}
              onImageChange={handleReferenceChange}
            />

            <ImageUploader
              label="Upload Comparison Image"
              preview={comparisonUrl}
              onImageChange={handleComparisonChange}
            />
          </div>

          <div className="mt-6 text-center">
            <button
              disabled={!canCompare || loading}
              onClick={handleCompare}
              className={`px-6 py-2 rounded font-semibold transition ${canCompare
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              {loading ? "Comparing..." : "Compare"}
            </button>
          </div>
        </div>

        <div className="w-full max-w-4xl">
          <ComparisonResult
            results={results}
            referenceImage={referenceUrl}
            comparisonImage={comparisonUrl}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </main>

      <footer className="py-6 text-center text-gray-400 text-xs">
        &copy; {new Date().getFullYear()} Image Comparison App
      </footer>
    </div>
  );
} 