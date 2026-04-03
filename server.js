import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dataRoutes from './routes/dataRoutes.js';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.use(express.json());
app.use(cookieParser()); // CRITICAL: Must be above routes

// CORS must be exact
app.use(cors({
    origin: [
        'http://localhost:5173', 
        'https://zenmange.netlify.app' // This allows any netlify preview/production URL
    ],
    credentials: true,               // Allows cookies to pass through
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- UPDATED LOGIN ROUTE ---
// We must set the cookie HERE or the 401 will never go away

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    // Set the cookie properly
    res.cookie('access_token', data.session.access_token, {
        httpOnly: true,    // Prevents JS theft
        secure: false,     // Set to true only in production (HTTPS)
        sameSite: 'lax',   // Required for cross-origin local dev
        maxAge: 3600 * 1000 // 1 hour
    });

    res.json({ user: data.user });
});

app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.listen(5000, () => console.log("Server: http://localhost:5000"));