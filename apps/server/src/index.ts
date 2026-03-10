import { Hono } from 'hono';
import { cors } from 'hono/cors';

export { GameRoom } from './durable_objects/game_room';
export { MatchmakingQueue } from './durable_objects/matchmaking_queue';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// CORS: WebSocket以外のルートにのみ適用
app.use('/api/*', cors({ origin: '*' }));
app.use('/', cors({ origin: '*' }));

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'harapeko-bahamut-server',
    timestamp: new Date().toISOString(),
  });
});

// Matchmaking WebSocket endpoint
app.get('/matchmaking', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }

  const id = c.env.MATCHMAKING_QUEUE.idFromName('global');
  const stub = c.env.MATCHMAKING_QUEUE.get(id);

  return stub.fetch(c.req.raw);
});

// Game room WebSocket endpoint
app.get('/ws/:roomId', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }

  const roomId = c.req.param('roomId');
  const id = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(id);

  const url = new URL(c.req.url);
  url.searchParams.set('roomId', roomId);

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// Matchmaking status API
app.get('/api/matchmaking/status', async (c) => {
  const id = c.env.MATCHMAKING_QUEUE.idFromName('global');
  const stub = c.env.MATCHMAKING_QUEUE.get(id);

  const response = await stub.fetch(
    new Request('https://internal/status', { method: 'GET' })
  );
  const data = await response.json();
  return c.json(data);
});

export default app;
