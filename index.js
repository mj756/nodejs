const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const PORT = process.env.PORT || 3000;

const users = new Map();
const rooms = new Map();


// --------------------------------------------------
// Helpers
// --------------------------------------------------

function getUser(socketId) {
  return users.get(socketId) || null;
}

function getRoom(roomName) {
  return rooms.get(roomName) || null;
}

function createUser(socket, data = {}) {
  return {
    ...data,
    id: socket.id
  };
}


// --------------------------------------------------
// Connection
// --------------------------------------------------

io.on('connection', (socket) => {

  // Send socket ID only to this client
  socket.emit('getSocketId', {
    id: socket.id
  });


  // ------------------------------------------------
  // Get all users
  // ------------------------------------------------

  socket.on('allUser', () => {
    socket.emit(
      'userList',
      Array.from(users.values())
    );
  });


  // ------------------------------------------------
  // User ready / online
  // ------------------------------------------------

  socket.on('ready', (data = {}) => {

    const user = createUser(socket, data);

    users.set(socket.id, user);

    // Current user
    socket.emit('ready', user);

    // Other users
    socket.broadcast.emit('userJoined', user);
  });


  // ------------------------------------------------
  // User manually leaves application
  // ------------------------------------------------

  socket.on('left', () => {

    const user = getUser(socket.id);

    if (!user) {
      return;
    }

    users.delete(socket.id);

    // Current user
    socket.emit('left', {
      id: socket.id
    });

    // Other users
    socket.broadcast.emit('userLeft', user);
  });


  // ------------------------------------------------
  // Get all rooms
  // ------------------------------------------------

  socket.on('getRooms', () => {

    socket.emit(
      'allRooms',
      Array.from(rooms.values()).map(room => ({
        roomName: room.roomName,
        users: room.users
      }))
    );
  });


  // ------------------------------------------------
  // Create room
  // ------------------------------------------------

  socket.on('createRoom', (data = {}) => {

    const roomName = data.roomName?.trim();

    if (!roomName) {
      return;
    }

    // Room already exists
    if (rooms.has(roomName)) {
      socket.emit('roomError', {
        message: 'Room already exists',
        roomName
      });

      return;
    }

    const user = createUser(socket, data);

    const room = {
      roomName,
      users: [user]
    };

    rooms.set(roomName, room);

    // Creator automatically joins Socket.IO room
    socket.join(roomName);

    // Only creator gets this
    socket.emit('roomCreated', {
      roomName
    });
  });


  // ------------------------------------------------
  // Join room
  // ------------------------------------------------

  socket.on('joinRoom', (data = {}) => {

    const roomName = data.roomName?.trim();

    if (!roomName) {
      return;
    }

    const room = getRoom(roomName);

    // Room doesn't exist
    if (!room) {

      socket.emit('roomError', {
        message: 'Room does not exist',
        roomName
      });

      return;
    }

    const user = createUser(socket, data);

    // Prevent duplicate user
    const alreadyJoined = room.users.some(
      existingUser => existingUser.id === socket.id
    );

    if (!alreadyJoined) {
      room.users.push(user);
    }

    // Join Socket.IO room
    socket.join(roomName);

    // Send to current user
    socket.emit('roomJoined', {
      roomName
    });

    // Notify other users in room
    socket.to(roomName).emit('roomJoined', {
      roomName,
      userDetail: user
    });
  });


  // ------------------------------------------------
  // Leave room
  // ------------------------------------------------

  socket.on('leaveRoom', (data = {}) => {

    const roomName = data.roomName?.trim();

    if (!roomName) {
      return;
    }

    const room = getRoom(roomName);

    if (!room) {
      return;
    }

    const userIndex = room.users.findIndex(
      user => user.id === socket.id
    );

    if (userIndex === -1) {
      return;
    }

    // Remove user from room
    room.users.splice(userIndex, 1);

    // Leave Socket.IO room
    socket.leave(roomName);

    // Current user
    socket.emit('roomLeft', {
      roomName
    });

    // Other users
    socket.to(roomName).emit('roomUserLeft', {
      id: socket.id,
      roomName
    });

    // Delete empty room
    if (room.users.length === 0) {
      rooms.delete(roomName);
    }
  });


  // ------------------------------------------------
  // Send message
  // ------------------------------------------------

  socket.on('sendMessage', (data = {}) => {

    const roomName = data.roomName;
    const receiverId = data.message?.receiverId;

    // Private message
    if (receiverId) {

      socket.to(receiverId).emit(
        'message',
        data
      );

      return;
    }

    // Room message
    if (roomName) {

      socket.to(roomName).emit(
        'roomMessage',
        data
      );

      return;
    }
  });


  // ------------------------------------------------
  // Disconnect
  // ------------------------------------------------

  socket.on('disconnect', () => {

    // ----------------------------------------------
    // Remove user from global users
    // ----------------------------------------------

    const user = getUser(socket.id);

    if (user) {

      users.delete(socket.id);

      socket.broadcast.emit(
        'userLeft',
        user
      );
    }


    // ----------------------------------------------
    // Remove user from every room
    // ----------------------------------------------

    for (const [roomName, room] of rooms) {

      const userIndex = room.users.findIndex(
        roomUser => roomUser.id === socket.id
      );

      if (userIndex === -1) {
        continue;
      }

      // Remove user
      room.users.splice(userIndex, 1);

      // Notify remaining room users
      socket.to(roomName).emit(
        'roomUserLeft',
        {
          id: socket.id,
          roomName
        }
      );

      // Remove empty room
      if (room.users.length === 0) {
        rooms.delete(roomName);
      }
    }
  });

});


// --------------------------------------------------
// Start server
// --------------------------------------------------

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
