import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SavedArticle from '../models/SavedArticle.js';
import MyFile from '../models/MyFile.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/saved-articles', requireAuth, async (req, res) => {
  try {
    const articles = await SavedArticle.find({ userId: req.user.userId }).sort('-savedAt');
    res.json({ articles });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/saved-articles', requireAuth, async (req, res) => {
   try {
     const article = await SavedArticle.create({ ...req.body, userId: req.user.userId });
     res.status(201).json({ article: { _id: article._id, ...article.toObject() } });
   } catch (err) {
     res.status(500).json({ message: 'Server error', error: err.message });
   }
 });
 
 router.delete('/saved-articles/:id', requireAuth, async (req, res) => {
   try {
     await SavedArticle.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
     res.json({ message: 'Article deleted' });
   } catch (err) {
     res.status(500).json({ message: 'Server error', error: err.message });
   }
 });

router.get('/my-files', requireAuth, async (req, res) => {
  try {
    const files = await MyFile.find({ userId: req.user.userId }).sort('-addedAt');
    res.json({ files });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/my-files', requireAuth, async (req, res) => {
  try {
    const file = await MyFile.create({ ...req.body, userId: req.user.userId });
    res.status(201).json({ file });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/my-files/:id', requireAuth, async (req, res) => {
  try {
    await MyFile.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;