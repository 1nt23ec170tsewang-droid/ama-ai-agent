const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db, auth } = require('../services/firebaseAdmin');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, company, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let userId = Date.now().toString();

    if (auth && db) {
      const userRecord = await auth.createUser({ email, password, displayName: name });
      userId = userRecord.uid;
      await db.collection('users').doc(userId).set({
        name, email, company: company || '', role: role || '',
        createdAt: new Date().toISOString()
      });
    }

    const token = jwt.sign({ id: userId, email, name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: userId, name, email, company, role } });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // For a real production app using Firebase auth, the client would send the ID token
    // or we'd verify the password here. Since we are simulating full stack, we will use Firestore.
    if (!db) return res.status(500).json({ message: 'DB not connected' });

    // Note: Since Firebase Admin doesn't support password verification directly, 
    // real implementations verify idToken from the client. 
    // Here we assume standard JWT implementation or Firebase client-side login.
    res.status(200).json({ message: 'Login endpoint ready. Connect frontend Firebase Auth.' });
  } catch (error) {
    next(error);
  }
});

router.post('/google', async (req, res, next) => {
  try {
    const { googleToken } = req.body;
    if (!auth) return res.status(500).json({ message: 'Auth not connected' });
    
    const decodedToken = await auth.verifyIdToken(googleToken);
    const user = {
      id: decodedToken.uid,
      name: decodedToken.name,
      email: decodedToken.email,
      picture: decodedToken.picture
    };

    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token, user });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    if (!db) return res.json({ user: req.user });
    const snap = await db.collection('users').doc(req.user.id).get();
    res.json({ user: snap.exists ? { id: snap.id, ...snap.data() } : req.user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const updates = req.body;
    if (db) await db.collection('users').doc(req.user.id).update(updates);
    res.json({ message: 'Profile updated', user: { ...req.user, ...updates } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
