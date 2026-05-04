const express = require('express');
const router = express.Router();
const claudeService = require('../services/claudeService');
const { db } = require('../services/firebaseAdmin');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/chat', authenticateToken, async (req, res, next) => {
  try {
    const { messages, userContext } = req.body;
    // In a real SSE implementation, we would use res.write() and flush headers.
    // Here we return the full string for simplicity unless streaming is strictly required.
    const response = await claudeService.chatWithAma(messages, userContext || { name: req.user.name });
    
    if (db) {
      await db.collection('conversations').add({
        userId: req.user.id,
        messages,
        response,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ response });
  } catch (error) {
    next(error);
  }
});

router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    if (!db) return res.json([]);
    const snap = await db.collection('conversations')
      .where('userId', '==', req.user.id)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    next(error);
  }
});

router.delete('/history', authenticateToken, async (req, res, next) => {
  try {
    if (!db) return res.json({ message: 'Cleared' });
    const snap = await db.collection('conversations').where('userId', '==', req.user.id).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ message: 'History cleared' });
  } catch (error) {
    next(error);
  }
});

router.post('/briefing', authenticateToken, async (req, res, next) => {
  try {
    const { date, userContext } = req.body;
    const cacheKey = `${req.user.id}_${date}`;
    
    if (db) {
      const cached = await db.collection('briefings').doc(cacheKey).get();
      if (cached.exists) return res.json({ briefing: cached.data().content });
    }

    const briefing = await claudeService.generateBriefing(date, userContext || { name: req.user.name });
    
    if (db) {
      await db.collection('briefings').doc(cacheKey).set({
        userId: req.user.id,
        date,
        content: briefing,
        createdAt: new Date().toISOString()
      });
    }
    res.json({ briefing });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
