import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// User management
let users = {}; // { socketId: { username, userId } }
let usernameToSocket = {}; // { username: socketId }

// Message storage
let groupMessages = [];
let privateMessages = {}; // { chatId: [ { user, text, time, to } ] }

function getPrivateChatId(userA, userB) {
  return [userA, userB].sort().join('::');
}

io.on('connection', (socket) => {
  let username = '';
  let userId = '';

  socket.on('join', ({ name, id }) => {
    username = name;
    userId = id;
    users[socket.id] = { username, userId };
    usernameToSocket[username] = socket.id;
    socket.join('public');
    io.emit('users', Object.values(users).map(u => u.username));
    socket.emit('chat history', { type: 'group', messages: groupMessages });
    io.emit('status', { user: username, online: true });
  });

  socket.on('group message', (msg) => {
    const message = { user: username, text: msg, time: new Date().toISOString(), type: 'group' };
    groupMessages.push(message);
    io.to('public').emit('message', message);
  });

  socket.on('private message', ({ to, text }) => {
    const chatId = getPrivateChatId(username, to);
    if (!privateMessages[chatId]) privateMessages[chatId] = [];
    const message = { user: username, to, text, time: new Date().toISOString(), type: 'private' };
    privateMessages[chatId].push(message);
    // Send to both sender and recipient if online
    const toSocket = usernameToSocket[to];
    socket.emit('private message', { chatId, message });
    if (toSocket) {
      io.to(toSocket).emit('private message', { chatId, message });
    }
  });

  socket.on('get private history', ({ withUser }) => {
    const chatId = getPrivateChatId(username, withUser);
    socket.emit('chat history', { type: 'private', chatId, messages: privateMessages[chatId] || [] });
  });

  socket.on('disconnect', () => {
    if (username) {
      delete usernameToSocket[username];
      delete users[socket.id];
      io.emit('users', Object.values(users).map(u => u.username));
      io.emit('status', { user: username, online: false });
    }
  });
});

app.get('/', (req, res) => {
  res.send('Chat server is running.');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 