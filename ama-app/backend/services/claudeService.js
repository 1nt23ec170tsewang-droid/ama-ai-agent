const { GoogleGenerativeAI } = require('@google/generative-ai');

let geminiModel = null;

try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Using gemini-1.5-flash as it has a higher free tier limit (15 req/min)
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
} catch (err) {
  console.warn('⚠️ Gemini not configured in AI Service:', err.message);
}

const safeGenerate = async (prompt, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      if (!geminiModel) throw new Error('AI Model not initialized. Check API Key.');
      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // exponential backoff
    }
  }
};

const generateBriefing = async (date, userContext) => {
  const prompt = `You are Ama, an executive AI Chief of Staff. Generate a concise, professional morning briefing.

Context: ${JSON.stringify(userContext)}
Date: ${date}

Structure exactly like this:
**Summary**: [2 sentences]
**Risks**:
- [Risk 1]
- [Risk 2]
**Focus**: [1 sentence recommendation]
**Metric**: [1 key metric to watch based on context]`;
  return await safeGenerate(prompt);
};

const summarizeEmail = async (sender, subject, body) => {
  const prompt = `Summarize this email in exactly 3 concise bullet points for a busy executive.
From: ${sender}
Subject: ${subject}
Body: ${body}

Format as:
• [Point 1]
• [Point 2]
• [Point 3]`;
  return await safeGenerate(prompt);
};

const draftEmailReply = async (sender, subject, body) => {
  const prompt = `Draft a professional reply to this email. Voice: CEO, under 120 words.
From: ${sender}
Subject: ${subject}
Body: ${body}

Return ONLY the email body.`;
  return await safeGenerate(prompt);
};

const prioritizeTasks = async (taskList) => {
  const prompt = `You are an executive Chief of Staff. Analyze these tasks and identify the top 3 priorities. Ranked by urgency + impact.

Tasks:
${JSON.stringify(taskList)}

For each top priority, provide:
- Task Name
- Reasoning
Format neatly.`;
  return await safeGenerate(prompt);
};

const breakdownTask = async (title, description) => {
  const prompt = `Break down this task into 4-6 subtasks.
Task: ${title}
Description: ${description}

Return ONLY a numbered list of concrete, actionable subtasks.`;
  return await safeGenerate(prompt);
};

const generateAnalyticsInsight = async (metrics) => {
  const prompt = `Analyze these metrics and provide 3 insights and 2 risks for an executive.
Metrics: ${JSON.stringify(metrics)}

Format:
**Insights:**
1. [Insight 1]
2. [Insight 2]
3. [Insight 3]

**Risks:**
• [Risk 1]
• [Risk 2]`;
  return await safeGenerate(prompt);
};

const generatePerformanceNote = async (member) => {
  const prompt = `Write a 3-4 sentence performance review note for this team member. Encouraging + constructive tone.
Member Context: ${JSON.stringify(member)}`;
  return await safeGenerate(prompt);
};

const chatWithAma = async (messages, userContext) => {
  const history = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  const prompt = `System: You are Ama, a highly intelligent AI Chief of Staff.
User Context: ${JSON.stringify(userContext)}

Conversation History:
${history}

Ama:`;
  return await safeGenerate(prompt);
};

module.exports = {
  generateBriefing,
  summarizeEmail,
  draftEmailReply,
  prioritizeTasks,
  breakdownTask,
  generateAnalyticsInsight,
  generatePerformanceNote,
  chatWithAma
};
