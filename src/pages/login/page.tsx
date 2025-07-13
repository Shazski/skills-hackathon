import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, Home } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/lib/firebase"

export function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const [toast, setToast] = useState<Toast | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("")
    setLoading(true)
    console.log('Login submitted:', { email, password });
    try {
      await signInWithEmailAndPassword(auth, email, password)
      setToast({
        message: 'Logged in Successfully!',
        type: 'success'
      });
      setTimeout(() => setToast(null), 4000);
      navigate("/") // Change this route as needed
    } catch (err: any) {
      setToast({
        message: 'Failed to login',
        type: 'error'
      });
      setTimeout(() => setToast(null), 4000);
      console.error("Login error:", err)
      setError(err.message)
      // toast.error(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  };

  return (
    <div className="flex items-start justify-center p-6 pt-20 md:pt-4 md:items-center w-full py-8">

      {toast && (
        <motion.div
          className="fixed top-4 right-4 z-[9999] max-w-sm"
          initial={{ opacity: 0, x: 100, y: -20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 100, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className={`rounded-xl p-4 shadow-lg border ${toast.type === 'info'
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
            : toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">
                {toast.type === 'info' ? '💡' : toast.type === 'success' ? '✅' : '⚠️'}
              </span>
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="w-full max-w-7xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
          <div className="relative w-sm z-10">
            <CardHeader className="text-center pb-6">
              <motion.div
                className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <Home className="w-8 h-8 text-white" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Welcome home!
                </CardTitle>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <CardDescription className="text-gray-600 dark:text-gray-400 text-base">
                  Your personal space is just a sign-in away.
                </CardDescription>
              </motion.div>
            </CardHeader>

            <CardContent className="pb-6">
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <motion.div
                    className="space-y-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="pl-10 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-md px-4 py-3 transition-all duration-300 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
                        required
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="pl-10 pr-10 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-md px-4 py-3 transition-all duration-300 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                </div>
              </form>
            </CardContent>

            <CardFooter className="flex-col gap-4 pt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="w-full"
              >
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r hover:cursor-pointer from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-md shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={handleSubmit}
                >
                  Sign In
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center w-full"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Don't have an account ?
                  </span>
                  <Link to="/signup">
                    <Button
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold p-0 h-auto text-sm hover:underline hover:cursor-pointer transition-all duration-200"
                      variant="link"
                    >
                      Sign Up
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </CardFooter>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
