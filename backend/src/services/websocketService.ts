import { Server as SocketIOServer, Socket } from 'socket.io';

export class WebSocketService {
  private static io: SocketIOServer;
  private static connectedClients: Map<string, Socket> = new Map();

  static initialize(io: SocketIOServer): void {
    this.io = io;

    io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      // Client can subscribe to a specific building's updates
      socket.on('subscribe:building', (buildingId: string) => {
        socket.join(`building:${buildingId}`);
        console.log(`Client ${socket.id} subscribed to building ${buildingId}`);
      });

      socket.on('unsubscribe:building', (buildingId: string) => {
        socket.leave(`building:${buildingId}`);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });

    console.log('WebSocket service initialized');
  }

  /**
   * Broadcast a new sensor reading to all clients subscribed to that building
   */
  static broadcastReading(buildingId: string, reading: any): void {
    if (!this.io) return;
    this.io.to(`building:${buildingId}`).emit('reading:new', reading);
  }

  /**
   * Broadcast a new alert
   */
  static broadcastAlert(buildingId: string, alert: any): void {
    if (!this.io) return;
    this.io.to(`building:${buildingId}`).emit('alert:new', alert);
  }

  /**
   * Broadcast an updated resilience score
   */
  static broadcastResilienceScore(buildingId: string, score: any): void {
    if (!this.io) return;
    this.io.to(`building:${buildingId}`).emit('resilience:update', score);
  }

  /**
   * Broadcast to all connected clients (global announcements)
   */
  static broadcastGlobal(event: string, data: any): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  static getConnectedCount(): number {
    return this.connectedClients.size;
  }
}
