import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export const authRouter = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-jwt-secret-for-poker-app';

// REGISTER
authRouter.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        globalChips: 1000 // Initial bankroll
      }
    });

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, globalChips: user.globalChips }});
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// LOGIN
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, globalChips: user.globalChips }});
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET ME (Fetch latest chips)
authRouter.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId }});
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json({ user: { id: user.id, username: user.username, globalChips: user.globalChips }});
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});
