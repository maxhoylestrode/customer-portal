import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import adminRoutes from './routes/admin';
import clientRoutes from './routes/clients';
import projectRoutes from './routes/projects';
import fileRoutes from './routes/files';
import staffDashboardRoutes from './routes/staffDashboard';
import settingsRoutes from './routes/settings';
import storageRoutes from './routes/storage';
import noteRoutes from './routes/notes';
import generalNoteRoutes from './routes/generalNotes';
import meetingRoutes from './routes/meetings';
import staffUserRoutes from './routes/staffUsers';
import { errorHandler } from './middleware/errorHandler';
import { UPLOAD_DIR } from './config/paths';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files. Only publicly-servable assets live under UPLOAD_DIR
// (ticket attachments, avatars, portal logo) — access-controlled client
// documents and internal storage files live outside it, in PRIVATE_UPLOAD_DIR,
// and are only ever streamed through authenticated controller routes.
app.use('/api/uploads', express.static(UPLOAD_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));

// Health check — registered before any auth-gated router so it's never
// shadowed by an upstream router's blanket authenticate middleware
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Client-portal routes (ticket system)
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);

// Staff-portal routes (client/project/CRM management)
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dashboard', staffDashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/general-notes', generalNoteRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/users', staffUserRoutes);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Apex Portal API running on http://localhost:${PORT}`);
});

export default app;
