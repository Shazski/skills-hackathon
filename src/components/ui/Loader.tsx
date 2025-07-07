import { motion } from 'framer-motion';

export const Loader = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="flex flex-col items-center"
    >
      <motion.svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-6"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
      >
        <defs>
          <linearGradient id="loader-gradient" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#A21CAF" />
          </linearGradient>
        </defs>
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke="url(#loader-gradient)"
          strokeWidth="10"
          strokeDasharray="180 100"
          strokeLinecap="round"
          fill="none"
        />
        <motion.circle
          cx="48"
          cy="48"
          r="28"
          stroke="#fff"
          strokeWidth="6"
          strokeDasharray="60 60"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', repeatType: 'reverse' }}
        />
      </motion.svg>
      <motion.div
        className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent drop-shadow-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Loading, please wait...
      </motion.div>
    </motion.div>
  </div>
); 