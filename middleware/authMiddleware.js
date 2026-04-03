import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Add this line at the VERY TOP
dotenv.config();

// Ensure these names match your .env file exactly
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_ANON_KEY
);

export const requireAuth = async (req, res, next) => {
    const token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No session cookie' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid session' });
    }

    req.user = user;
    next();
};