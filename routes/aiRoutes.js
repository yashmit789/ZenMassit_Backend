import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/authMiddleware.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// backend/routes/aiRoutes.js

// --- GET CHAT HISTORY ---
router.get('/history', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: true });

    if (error) return res.status(400).json(error);
    res.json(data);
});

// --- CLEAR HISTORY (Optional but useful for that "Clear History" button) ---
router.delete('/history', requireAuth, async (req, res) => {
    const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', req.user.id);

    if (error) return res.status(400).json(error);
    res.json({ message: "History cleared" });
});

router.post('/chat', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { message } = req.body;

    try {
        // 1. FETCH MULTI-SOURCE CONTEXT
        console.log("Gathering user context...");
        const [
            { data: goals }, 
            { data: habits }, 
            { data: sleep }, 
            { data: historyData },
            { data: events }
        ] = await Promise.all([
            supabase.from('goals').select('title, description').eq('completed', false).eq('user_id', userId),
            supabase.from('habits').select('name, streak').eq('user_id', userId),
            supabase.from('sleep_logs').select('hours').eq('user_id', userId).order('date', { ascending: false }).limit(1),
            supabase.from('chat_messages').select('role, content').eq('user_id', userId).order('created_at', { ascending: true }).limit(10),
            supabase.from('planner_events').select('*').eq('user_id', userId)
        ]);

        // 2. BUILD DYNAMIC SYSTEM INSTRUCTION
        let systemInstruction = `You are Zen AI, an intelligent and conversational assistant inside the "ZenFlow" app.\n\n`;
        systemInstruction += `USER DATA (STRICTLY FOR BACKGROUND CONTEXT):\n`;
        
        if (goals?.length > 0) systemInstruction += `- Active Goals: ${goals.map(g => `title : ${g.title} , Description: ${g.description}`).join(', ')}\n`;
        if (habits?.length > 0) systemInstruction += `- Habits Tracked: ${habits.map(h => `${h.name} (${h.streak} day streak)`).join(', ')}\n`;
        if (sleep?.length > 0) systemInstruction += `- Hours slept last night: ${sleep[0].hours} hours\n`;
        if (events?.length > 0) systemInstruction += `- Upcoming Events: ${events.map(e => `${e.title} on ${new Date(e.date).toLocaleDateString()}`).join(', ')}\n`;

        systemInstruction += `\nCRITICAL DIRECTIVES:
1. PASSIVE KNOWLEDGE ONLY: Never mention specific goals or habits unless the user explicitly asks.
2. ZERO INNER MONOLOGUE: Never output your thought process in the final response. 
3. OUTPUT FORMAT: You must output a "Thinking:" section followed by a "*Draft:*" section.

EXAMPLES:
User: "hey"
Zen AI:
Thinking: Brief greeting. Matching energy.
*Draft:* Hey there! How can I help you today?

User: "what are my goals?"
Zen AI:
Thinking: Explicit request for data. Accessing background context.
*Draft:* You currently have ${goals?.length || 0} active goals, including ${goals?.[0]?.title || 'none'}.`;

        // 3. INITIALIZE MODEL
        const model = genAI.getGenerativeModel({ 
            model: "gemma-4-26b-a4b-it", // Using the stable Gemini model
            systemInstruction 
        });

        // 4. FORMAT HISTORY (Applying the User-First Rule)
        let formattedHistory = (historyData || []).map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        while (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
            formattedHistory.shift();
        }

        const chat = model.startChat({ history: formattedHistory });
        
        // 5. SEND MESSAGE & CLEAN OUTPUT
        const result = await chat.sendMessage(message);
        let rawText = result.response.text();

        // We only send the part AFTER *Draft:* to the user
        let botText = rawText;
        if (rawText.includes("*Draft:*")) {
            botText = rawText.split("*Draft:*").pop().trim();
        }

        // 6. SAVE TO DATABASE
        await supabase.from('chat_messages').insert([
            { role: 'user', content: message, user_id: userId },
            { role: 'model', content: botText, user_id: userId }
        ]);

        res.json({ reply: botText });

    } catch (error) {
        console.error("AI Route Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;