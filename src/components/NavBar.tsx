import LOGO from '../assets/logo.jpg'
import { ModeToggle } from './mode-toggle';
import { motion } from 'framer-motion';
import { Home, Search, User, Bell, Menu } from 'lucide-react';
import { Button } from './ui/button';

export function NavBar() {
  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <motion.a
            href='/home'
            className="flex items-center space-x-3 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.img
              src={LOGO}
              alt="Logo"
              className="h-8 w-8 rounded-lg shadow-md"
              whileHover={{ rotate: 5 }}
              transition={{ type: "spring", stiffness: 200 }}
            />
            <motion.span
              className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              HomeFinder
            </motion.span>
          </motion.a>
          <motion.div
            className="hidden md:flex items-center space-x-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.a
              href="/home"
              className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </motion.a>
            <motion.a
              href="#search"
              className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </motion.a>
          </motion.div>
          <motion.div
            className="flex items-center space-x-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              className="relative"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ModeToggle />
            </motion.div>

            <motion.div
              className="md:hidden"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="md:hidden border-t border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="px-4 py-2 space-y-2">
          <a href="/home" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Home className="h-4 w-4" />
            <span>Home</span>
          </a>
          <a href="#search" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Search className="h-4 w-4" />
            <span>Search</span>
          </a>
          <a href="#profile" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </a>
        </div>
      </motion.div>
    </motion.nav>
  )
}
