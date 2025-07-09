import LOGO from '../assets/logo.jpg'
import { ModeToggle } from './mode-toggle';
import { motion } from 'framer-motion';
import { Home, Search, User, Menu, X, Building, DoorOpen, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { useLocation, useNavigate, NavLink } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { getAllHomes, getRoomsByHomeId } from '../lib/firebaseService';

interface SearchResult {
  id: string;
  name: string;
  type: 'home' | 'room';
  homeId?: string;
  homeName?: string;
  description?: string;
}

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const results: SearchResult[] = [];
      const searchTerm = query.toLowerCase();

      const homes = await getAllHomes();
      const homeMatches = homes.filter(home =>
        home.name.toLowerCase().includes(searchTerm) ||
        home.address.toLowerCase().includes(searchTerm)
      );

      homeMatches.forEach(home => {
        results.push({
          id: home.id,
          name: home.name,
          type: 'home',
          description: home.address
        });
      });

      for (const home of homes) {
        const rooms = await getRoomsByHomeId(home.id);
        const roomMatches = rooms.filter(room =>
          room.name.toLowerCase().includes(searchTerm) ||
          room.description.toLowerCase().includes(searchTerm)
        );

        roomMatches.forEach(room => {
          results.push({
            id: room.id,
            name: room.name,
            type: 'room',
            homeId: home.id,
            homeName: home.name,
            description: room.description
          });
        });
      }

      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };


  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'home') {
      navigate(`/rooms/${result.id}`);
    } else if (result.type === 'room') {
      navigate(`/rooms/${result.homeId}`);
    }
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleLogout = async () => {
    try {
      // If using Firebase Auth:
      // await signOut(auth);

      // Otherwise:
      localStorage.removeItem('authToken'); // Example token/key
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <motion.div
            className="flex items-center space-x-3 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "inertia", stiffness: 300 }}
            onClick={() => navigate('/')}
          >
            <motion.img
              src={LOGO}
              alt="Logo"
              className="h-8 w-8 rounded-lg shadow-md"
              whileHover={{ rotate: 5 }}
              transition={{ type: "decay", stiffness: 200 }}
            />
            <NavLink to="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              HomeFinder
            </NavLink>
          </motion.div>

          {/* {!isAuthPage && (
            <motion.div
              className="hidden md:flex items-center space-x-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium ${isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`
                }
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </NavLink>
            </motion.div>
          )} */}

          <div className='flex items-center space-x-3 cursor-pointer'>
            {!isAuthPage && (
              <motion.div
                className="flex-1 max-w-md relative"
                ref={searchRef}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search homes and rooms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <motion.div
                        className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                  )}
                </div>

                {showSearchResults && searchResults.length > 0 && (
                  <motion.div
                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {searchResults.map((result, index) => (
                      <motion.div
                        key={`${result.type}-${result.id}`}
                        className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        onClick={() => handleResultClick(result)}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {result.type === 'home' ? (
                              <Building className="h-5 w-5 text-blue-500" />
                            ) : (
                              <DoorOpen className="h-5 w-5 text-green-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {result.name}
                              </p>
                              <span className={`text-xs px-2 py-1 rounded-full ${result.type === 'home'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                }`}>
                                {result.type === 'home' ? 'Home' : 'Room'}
                              </span>
                            </div>
                            {result.type === 'room' && result.homeName && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                in {result.homeName}
                              </p>
                            )}
                            {result.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {result.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}


                {showSearchResults && searchQuery && searchResults.length === 0 && !isSearching && (
                  <motion.div
                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-gray-500 dark:text-gray-400">No homes or rooms found</p>
                  </motion.div>
                )}
              </motion.div>
            )}

            <motion.div
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <ModeToggle />
              </motion.div>

              {!isAuthPage && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex items-center space-x-1 border border-gray-300 dark:border-gray-600"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {!isAuthPage && (
        <motion.div
          className="md:hidden border-t border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="px-4 py-2 space-y-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`
              }
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </NavLink>
            <NavLink
              to="#profile"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`
              }
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </NavLink>
          </div>
        </motion.div>
      )}
    </motion.nav>
  )
}
