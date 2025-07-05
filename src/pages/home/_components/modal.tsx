import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Home, X } from "lucide-react"
import { motion } from "framer-motion"
import { useState } from "react"

export function CreateHomeModal() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    const fileInput = document.getElementById('image-1') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted');
  };

  return (
    <Dialog>
      <form onSubmit={handleSubmit}>
        <DialogTrigger asChild>
          <motion.div
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Button
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border-0 cursor-pointer group relative overflow-hidden text-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              <span className="relative z-10 flex items-center gap-2">
                <Home className="w-4 h-4" />
                <span>Create Home</span>
                <Plus className="w-3 h-3" />
              </span>
            </Button>
          </motion.div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[450px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg animate-in fade-in-90 slide-in-from-top-8 zoom-in-90 duration-300 ease-out">
          <DialogHeader className="pb-6">
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Home
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Add a new property to your collection
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name-1" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Home Name
              </Label>
              <Input
                id="name-1"
                name="name"
                className="border border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-md px-3 py-2 transition-colors"
                placeholder="Enter home name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username-1" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Home Address
              </Label>
              <Input
                id="username-1"
                name="username"
                className="border border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-md px-3 py-2 transition-colors"
                placeholder="Enter home address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image-1" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Home Image
              </Label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md p-4 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                <input
                  id="image-1"
                  name="image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                {selectedImage ? (
                  <div className="relative">
                    <img
                      src={selectedImage}
                      alt="Selected home"
                      className="w-full h-32 object-cover rounded-md"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label htmlFor="image-1" className="cursor-pointer">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">Click to upload</span> or drag and drop
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        PNG, JPG, GIF up to 10MB
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-6 gap-3">
            <DialogClose asChild>
              <Button
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                variant="outline"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
              type="button"
              onClick={handleSubmit}
            >
              Create Home
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  )
}
