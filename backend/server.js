import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import memberRoutes from './routes/members.js';
import configRoutes from './routes/config.js';
import yearRoutes from './routes/years.js';
import paymentRoutes from './routes/payments.js';
import exceptionalRoutes from './routes/exceptional.js';
import importRoutes from './routes/import.js';
import exportRoutes from './routes/export.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make prisma available in req
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Routes
app.get('/api', (req, res) => {
  res.json({ message: 'AssocManager API V1', status: 'OK' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/config', configRoutes);
app.use('/api/years', yearRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/exceptional', exceptionalRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/exceptional', exceptionalRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AssocManager API démarrée sur le port ${PORT}`);
  console.log(`📍 http://0.0.0.0:${PORT}/api`);
});

export default app;
