import { motion } from 'framer-motion';

export const Loader = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      className="flex flex-col items-center"
    >
      {/* Fancy, funny animated ring with a face */}
      <motion.div
        className="relative flex items-center justify-center"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
      >
        {/* Soft glow */}
        <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-indigo-400/30 via-purple-400/20 to-pink-400/10 blur-xl" />
        {/* Animated ring */}
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
          <defs>
            <linearGradient id="loader-gradient" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1" />
              <stop offset="1" stopColor="#A21CAF" />
            </linearGradient>
          </defs>
          <motion.circle
            cx="44"
            cy="44"
            r="36"
            stroke="url(#loader-gradient)"
            strokeWidth="9"
            strokeDasharray="160 60"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0.2 }}
            animate={{ pathLength: 1 }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut', repeatType: 'reverse' }}
          />
        </svg>
        {/* Funny animated face */}
        <div className="absolute left-0 top-0 w-full h-full flex flex-col items-center justify-center pointer-events-none">
          {/* Eyes */}
          <div className="flex justify-center items-center mt-6">
            <motion.div
              className="w-3 h-3 bg-white rounded-full border-2 border-indigo-400 mx-2"
              animate={{ y: [0, -2, 0], scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.2, repeatType: 'reverse', delay: 0.1 }}
            />
            <motion.div
              className="w-3 h-3 bg-white rounded-full border-2 border-indigo-400 mx-2"
              animate={{ y: [0, -2, 0], scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.2, repeatType: 'reverse', delay: 0.3 }}
            />
          </div>
          {/* Smiling mouth */}
          <motion.svg
            width="28"
            height="12"
            viewBox="0 0 28 12"
            className="mt-2"
            animate={{ y: [0, 2, 0], scaleX: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, repeatType: 'reverse', delay: 0.2 }}
          >
            <path
              d="M2 2 Q 14 14 26 2"
              stroke="#A21CAF"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </motion.svg>
        </div>
      </motion.div>
      {/* Playful loader text */}
      <motion.div
        className="mt-8 text-lg font-bold bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent drop-shadow"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        Loading... Please don't blink! 😉
      </motion.div>
    </motion.div>
  </div>
); 