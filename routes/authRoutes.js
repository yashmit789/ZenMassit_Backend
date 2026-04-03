import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Initialize Supabase Client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);
router.get('/me', async (req, res) => {
    const token = req.cookies.access_token;

    if (!token) {
        return res.status(401).json({ user: null });
    }

    // Ask Supabase to verify the token from the cookie
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ user: null });
    }

    res.status(200).json({ user });
});
// --- 1. SIGNUP ---
router.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Signup successful! Check your email.', user: data.user });
});

// --- 2. LOGIN (The Cookie Dropper) ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) throw error;

        // SET THE SECURE COOKIE
        // This is what makes the 401 error disappear!
        res.cookie('access_token', data.session.access_token, {
            httpOnly: true,     // Prevents cross-site scripting (XSS)
            secure: process.env.NODE_ENV === 'production', // true in production (HTTPS)
            sameSite: 'lax',    // Allows cross-origin requests on localhost
            maxAge: 3600 * 1000 // 1 hour
        });

        res.status(200).json({ 
            message: 'Login successful', 
            user: data.user 
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- 3. LOGOUT ---
router.post('/logout', (req, res) => {
    // Clear the cookie from the browser
    res.clearCookie('access_token');
    res.status(200).json({ message: 'Logged out successfully' });
});

export default router;