import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dataRoutes from './routes/dataRoutes.js';

dotenv.config();
const app = express();

app.use(express.json());
app.use(cookieParser()); // CRITICAL: Must be above routes

// --- HEALTH CHECK ROUTE ---
app.get('/', (req, res) => {
    res.json({ message: "ZenFlow API is running successfully!" });
});

// --- CORS SETTINGS ---
app.use(cors({
    origin: [
        'http://localhost:5173', 
        'https://zenmange.netlify.app' // Your hosted frontend
    ],
    credentials: true,               // Allows cookies to pass through
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- ROUTES ---
// All authentication logic is now safely delegated to authRoutes.js
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));