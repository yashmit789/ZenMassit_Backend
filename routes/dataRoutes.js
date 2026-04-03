import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/authMiddleware.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Initialize Supabase - Use Service Role Key for backend to bypass RLS
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Apply middleware once to all routes below
router.use(requireAuth);

// --- 🎯 GOALS ---
router.get('/goals', async (req, res) => {
    const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', req.user.id)
        .order('target_date', { ascending: true });
    if (error) return res.status(400).json(error);
    res.json(data);
});

router.post('/goals', async (req, res) => {
    const { title, description, target_date } = req.body;
    const { data, error } = await supabase
        .from('goals')
        .insert([{ user_id: req.user.id, title, description, target_date, completed: false, duration_seconds: 0 }])
        .select();
    if (error) return res.status(400).json(error);
    res.status(201).json(data[0]);
});

router.patch('/goals/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('goals')
        .update(req.body) // Handles both 'completed' toggle and 'duration_seconds'
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select();
    if (error) return res.status(400).json(error);
    res.json(data[0]);
});

router.delete('/goals/:id', async (req, res) => {
    const { error } = await supabase.from('goals').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json(error);
    res.json({ message: "Goal deleted" });
});

// --- 🔥 HABITS ---
router.get('/habits', async (req, res) => {
    const { data, error } = await supabase.from('habits').select('*').eq('user_id', req.user.id).order('name');
    if (error) return res.status(400).json(error);
    res.json(data);
});

router.post('/habits', async (req, res) => {
    const { name } = req.body;
    const { data, error } = await supabase.from('habits').insert([{ user_id: req.user.id, name, streak: 0 }]).select();
    if (error) return res.status(400).json(error);
    res.json(data[0]);
});

router.patch('/habits/:id', async (req, res) => {
    const { streak } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('habits').update({ streak, last_completed: today }).eq('id', req.params.id).eq('user_id', req.user.id).select();
    if (error) return res.status(400).json(error);
    res.json(data[0]);
});

router.delete('/habits/:id', async (req, res) => {
    const { error } = await supabase.from('habits').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json(error);
    res.json({ message: "Habit deleted" });
});

// --- 📅 PLANNER ---
router.get('/planner', async (req, res) => {
    const { data, error } = await supabase.from('planner_events').select('*').eq('user_id', req.user.id).order('event_date', { ascending: true });
    if (error) return res.status(400).json(error);
    res.json(data);
});

router.post('/planner', async (req, res) => {
    const { title, event_date } = req.body;
    const { data, error } = await supabase.from('planner_events').insert([{ user_id: req.user.id, title, event_date }]).select();
    if (error) return res.status(400).json(error);
    res.json(data[0]);
});

router.delete('/planner/:id', async (req, res) => {
    const { error } = await supabase.from('planner_events').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json(error);
    res.json({ message: "Event deleted" });
});

// --- 🌙 SLEEP ---
router.post('/sleep', async (req, res) => {
    const { hours } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('sleep_logs').insert([{ user_id: req.user.id, hours, date: today }]).select();
    if (error) return res.status(400).json(error);
    res.json(data[0]);
});

// --- 🏃 HEALTH ---
router.post('/health', async (req, res) => {
    const { water_glasses, exercise_minutes } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('health_logs').insert([{ 
        user_id: req.user.id, 
        water_glasses: parseInt(water_glasses) || 0, 
        exercise_minutes: parseInt(exercise_minutes) || 0,
        date: today 
    }]).select();
    if (error) return res.status(400).json(error);
    res.json(data[0]);
});

// --- 📊 DASHBOARD SUMMARY ---
router.get('/summary', async (req, res) => {
    const userId = req.user.id;
    try {
        const [goalsRes, habitsRes, sleepRes] = await Promise.all([
            supabase.from('goals').select('*').eq('user_id', userId),
            supabase.from('habits').select('*').eq('user_id', userId),
            supabase.from('sleep_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7)
        ]);

        const goals = goalsRes.data || [];
        const habits = habitsRes.data || [];
        const sleep = sleepRes.data || [];

        const activeGoals = goals.filter(g => !g.completed).length;
        const completedCount = goals.filter(g => g.completed).length;
        const progress = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;
        const totalStreak = habits.reduce((acc, h) => acc + (h.streak || 0), 0);
        const avgSleep = sleep.length > 0 ? (sleep.reduce((acc, s) => acc + parseFloat(s.hours), 0) / sleep.length).toFixed(1) : 0;

        res.json({
            stats: { activeGoals, completedCount, totalStreak, avgSleep, progress },
            rawGoals: goals,
            charts: { sleepData: sleep.reverse(), habits }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;