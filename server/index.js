const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. IMPORT ROUTES
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contactRoutes');
const profileRoutes = require('./routes/profileRoutes'); 

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// 2. MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. DATABASE CONNECTION
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// 🟢 4. HEALTH GATE (Bulletproof)
// Responds "OK" to any health check URL the app might use
app.get('/', (req, res) => res.status(200).send("Qcall API Running..."));
app.get('/api', (req, res) => res.status(200).send("Qcall Server is Online 🟢")); 
app.get('/health', (req, res) => res.status(200).send("OK"));
app.get('/api/health', (req, res) => res.status(200).send("OK"));

// 5. SETUP ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/profile', profileRoutes);

// 6. START SERVER
app.listen(PORT, () => {
  connectDB();
  console.log(`🚀 Server running on port ${PORT}`);
});