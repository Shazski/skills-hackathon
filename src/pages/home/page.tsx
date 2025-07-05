import { Button } from '@/components/ui/button';
import LOGO from '../../assets/logo.jpg';
import { CreateHomeModal } from './_components/modal';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';

export const Home = () => {
  const navigate = useNavigate();

  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15, type: "spring" as const, stiffness: 60 },
    }),
  };

  const handleCardClick = (homeId: number) => {
    navigate(`/rooms/${homeId}`);
  };

  return (
    <div className="px-4 md:px-12 pb-20 md:pb-4">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <motion.h1
          className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          🏠 Your Homes
        </motion.h1>
        <motion.div
          className="h-1 w-32 mx-auto bg-gradient-to-r from-blue-400 via-fuchsia-400 to-purple-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: "8rem" }}
          transition={{ delay: 0.5, duration: 0.8 }}
        />
        <motion.p
          className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mt-4 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          Discover your perfect living spaces
        </motion.p>
      </motion.div>
      <motion.div
        className="flex justify-end mb-6 me-14 mt-2"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <CreateHomeModal />
      </motion.div>
      <div className="flex flex-wrap justify-center md:justify-evenly gap-6 mt-8 mb-20">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((_, i) => (
          <motion.div
            key={i}
            className="group relative w-[280px] bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            onClick={() => handleCardClick(i + 1)}
            whileHover={{ y: -5, scale: 1.02 }}
          >
            <div className="relative overflow-hidden h-48">
              <motion.img
                src={LOGO}
                alt={`Home ${i + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.3 }}
              />

              {i === 3 && (
                <motion.div
                  className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-1 shadow-lg"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </motion.div>
              )}
            </div>

            <div className="p-4">
              <motion.h3
                className="text-lg font-bold text-gray-900 dark:text-white mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                Home {i + 1}
              </motion.h3>
              <motion.div
                className="flex items-center gap-3 mb-4 text-sm text-gray-600 dark:text-gray-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.1 }}
              >
                <span>🛏️ {i + 2} beds</span>
                <span>🚿 {i + 1} baths</span>
              </motion.div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer px-2 py-1"
                  size="sm"
                >
                  📬 View
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg cursor-pointer px-2 py-1"
                  size="sm"
                >
                  ✉️ Send
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg cursor-pointer px-2 py-1"
                  size="sm"
                >
                  ✏️ Edit
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Add this to your global CSS for gradient animation:
// .animate-gradient-x {
//   background-size: 200% 200%;
//   animation: gradient-x 3s ease infinite;
// }
// @keyframes gradient-x {
//   0% { background-position: 0% 50%; }
//   50% { background-position: 100% 50%; }
//   100% { background-position: 0% 50%; }
// }
