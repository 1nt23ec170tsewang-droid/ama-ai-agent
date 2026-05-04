import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Briefcase, Calendar, CheckSquare } from 'lucide-react';
import { motion } from 'motion/react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <motion.header
        className="bg-white border-b border-gray-200"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-2xl">Chief of Staff Portal</h1>
              <p className="text-gray-600 mt-1">Welcome back, {user.name}</p>
            </motion.div>
            <motion.button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </motion.button>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
              >
                <Briefcase className="w-6 h-6 text-blue-600" />
              </motion.div>
              <div>
                <h3 className="text-lg">Active Projects</h3>
                <motion.p
                  className="text-2xl mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  12
                </motion.p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
              >
                <CheckSquare className="w-6 h-6 text-green-600" />
              </motion.div>
              <div>
                <h3 className="text-lg">Tasks Completed</h3>
                <motion.p
                  className="text-2xl mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  48
                </motion.p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition"
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
              >
                <Calendar className="w-6 h-6 text-purple-600" />
              </motion.div>
              <div>
                <h3 className="text-lg">Meetings This Week</h3>
                <motion.p
                  className="text-2xl mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  7
                </motion.p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-8 bg-white rounded-xl shadow-sm p-6 border border-gray-200"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-xl mb-4">Recent Activity</h2>
          <motion.div
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              variants={itemVariants}
              whileHover={{ x: 10, backgroundColor: "#f9fafb" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="w-2 h-2 bg-blue-500 rounded-full"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              ></motion.div>
              <div className="flex-1">
                <p>Quarterly review scheduled with leadership team</p>
                <p className="text-sm text-gray-600 mt-1">2 hours ago</p>
              </div>
            </motion.div>
            <motion.div
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              variants={itemVariants}
              whileHover={{ x: 10, backgroundColor: "#f9fafb" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="w-2 h-2 bg-green-500 rounded-full"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
              ></motion.div>
              <div className="flex-1">
                <p>Budget proposal approved by finance</p>
                <p className="text-sm text-gray-600 mt-1">5 hours ago</p>
              </div>
            </motion.div>
            <motion.div
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              variants={itemVariants}
              whileHover={{ x: 10, backgroundColor: "#f9fafb" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="w-2 h-2 bg-purple-500 rounded-full"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.6 }}
              ></motion.div>
              <div className="flex-1">
                <p>New stakeholder report generated</p>
                <p className="text-sm text-gray-600 mt-1">1 day ago</p>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
