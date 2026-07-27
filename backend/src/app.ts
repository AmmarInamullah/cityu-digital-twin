import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import connectDB from './config/database';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimit, writeRateLimit } from './middleware/rateLimit';
import { WebSocketService } from './services/websocketService';
import readingRoutes from './routes/readingRoutes';
import buildingRoutes from './routes/buildingRoutes';
import resilienceRoutes from './routes/resilienceRoutes';
import alertRoutes from './routes/alertRoutes';
import analysisRoutes from './routes/analysisRoutes';

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/readings', apiRateLimit, readingRoutes);
app.use('/api/buildings', apiRateLimit, buildingRoutes);
app.use('/api/resilience', apiRateLimit, resilienceRoutes);
app.use('/api/alerts', apiRateLimit, alertRoutes);
app.use('/api/analysis', apiRateLimit, analysisRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CityU Resilience Digital Twin API is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connectedClients: WebSocketService.getConnectedCount(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handling
app.use(errorHandler);

// Create HTTP server + Socket.IO
const server = createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

WebSocketService.initialize(io);

const PORT = env.PORT;

server.listen(PORT, () => {
  console.log(`CityU Digital Twin API running on port ${PORT}`);
  console.log(`WebSocket server initialized`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

export default app;
export { io };
