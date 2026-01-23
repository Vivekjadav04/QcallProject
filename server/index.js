const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. Import Routes (Moved all to the top)
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profileRoutes');
const contactRoutes = require('./routes/contactRoutes'); 

// Load environment variables
dotenv.config();

// Initialize the app
const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
app.use(cors()); 
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

// 🟢 HEALTH CHECK ROUTE (The "Ping" Endpoint)
// This is required for your App's "Health Gate" to pass
app.get('/api', (req, res) => {
  res.status(200).send("Qcall Server is Online 🟢");
});

// Basic Test Route (Root)
app.get('/', (req, res) => {
  res.send('Qcall API is running...');
});

// Route Middlewares (Defined BEFORE app.listen)
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/contacts', contactRoutes);

// Start the Server
app.listen(PORT, () => {
  connectDB();
  console.log(`🚀 Server running on port ${PORT}`);
});