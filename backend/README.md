# SlotPot Backend

Real-time chat and game backend for the SlotPot betting platform.

## Features

🔌 **Real-time Chat** - WebSocket communication with Socket.io  
🎰 **Game Events** - Betting notifications and game state  
👥 **User Management** - Connection tracking and user sessions  
📝 **Message History** - Persistent chat history (in-memory)  
🔄 **Auto-reconnection** - Robust connection handling  

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev    # with nodemon for auto-restart
# or
npm start      # production mode
```

The server will start on `http://localhost:5000`

## API Endpoints

### Health Check
```
GET /health
```
Returns server status.

### Chat Messages
```
GET /api/chat/messages
```
Returns recent chat history and connected user count.

### Game State
```
GET /api/game/state
```
Returns current game state (jackpot, round, players).

## WebSocket Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `user:join` | `{username, avatar, isPremium}` | Join chat with user info |
| `chat:message` | `{message}` | Send a chat message |
| `chat:typing` | `boolean` | Toggle typing indicator |
| `game:bet` | `{amount}` | Place a bet (triggers chat notification) |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `chat:message` | `{id, username, message, timestamp, type}` | New chat message |
| `chat:history` | `Message[]` | Chat history on connect |
| `user:joined` | `{username, totalUsers}` | User joined notification |
| `user:left` | `{username, totalUsers}` | User left notification |
| `user:typing` | `{username, isTyping}` | Typing indicator |
| `game:state` | `{jackpot, currentRound, players}` | Game state updates |

## Frontend Integration

### 1. Install Socket.io Client
```bash
npm install socket.io-client
```

### 2. Use the Hook
```javascript
import useChat from '../hooks/useChat';

const ChatComponent = () => {
  const {
    messages,
    isConnected,
    sendMessage,
    handleTyping
  } = useChat();

  // Send message
  const handleSend = () => {
    sendMessage("Hello everyone!");
  };

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.message}</div>
      ))}
    </div>
  );
};
```

## Configuration

Environment variables (create `.env` file):

```env
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
MAX_MESSAGE_LENGTH=500
MAX_CHAT_HISTORY=100
```

## Message Types

- **`user`** - Regular user messages
- **`system`** - System announcements  
- **`bet`** - Betting notifications
- **`win`** - Winner announcements

## Development

### Project Structure
```
backend/
├── server.js          # Main server file
├── package.json       # Dependencies
└── README.md          # This file
```

### Adding Features

1. **New Socket Events** - Add handlers in `server.js`
2. **API Endpoints** - Add routes before socket setup
3. **Database** - Replace in-memory storage with persistent DB
4. **Authentication** - Add JWT or session-based auth

## Testing

### Manual Testing
1. Open multiple browser tabs to `http://localhost:3000`
2. Send messages from different tabs
3. Check real-time synchronization

### API Testing
```bash
# Health check
curl http://localhost:5000/health

# Get messages
curl http://localhost:5000/api/chat/messages

# Get game state
curl http://localhost:5000/api/game/state
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use process manager (PM2)
3. Add database for persistence
4. Configure reverse proxy (nginx)
5. Set up SSL certificates

## Tech Stack

- **Node.js** - Runtime
- **Express** - Web framework  
- **Socket.io** - WebSocket communication
- **CORS** - Cross-origin support
- **UUID** - Unique message IDs

## Next Steps

- [ ] Add user authentication
- [ ] Implement message persistence (MongoDB/PostgreSQL)
- [ ] Add rate limiting for chat messages
- [ ] Implement chat moderation features
- [ ] Add private messaging
- [ ] Game logic integration (TON blockchain) 