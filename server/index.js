const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Import Routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profileRoutes');

// Load environment variables
dotenv.config();

// Initialize the app
const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE (Fixed) ---
app.use(cors()); // Allow React Native app to connect

// 🔴 FIX: Only declare body parsers ONCE with the 50mb limit.
// (Removing the duplicate default line fixes the 413 Error)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1); 
  }
};

// Basic Test Route
app.get('/', (req, res) => {
  res.send('Qcall API is running...');
});

// Route Middlewares
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// Start the Server
app.listen(PORT, () => {
  connectDB();
  console.log(`🚀 Server running on port ${PORT}`);
});

// Import route
const contactRoutes = require('./routes/contactRoutes');

// Use route
app.use('/api/contacts', contactRoutes);