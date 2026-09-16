const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();

// Serve static files from public folder & root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  },
  // 1 MB chunks, so 2 MB is plenty of room
  maxHttpBufferSize: 2 * 1024 * 1024
});
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_CHUNK_SIZE = 1024 * 1024;  

const PORT = process.env.PORT || 3000;

const users = new Map();
const rooms = new Map();
const fileTransfers = new Map();

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function getUserByUserId(userId) {
  for (const user of users.values()) {
    if (user.userId === userId) {
      return user;
    }
  }

  return null;
}

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

    // Broadcast to ALL users so the new room is visible immediately
    io.emit('roomCreated', {
      roomName,
      creatorId: socket.id
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



  socket.on('fileStart', (data = {}) => {

    try {

      const {
        uploadId,
        senderId,
        receiverId,
        fileName,
        fileSize,
        fileType
      } = data;


      // -----------------------------------------------
      // Validate data
      // -----------------------------------------------

      if (
        !uploadId ||
        !senderId ||
        !receiverId ||
        !fileName ||
        !Number.isInteger(fileSize)
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Invalid file information'
          }
        );
      }


      // -----------------------------------------------
      // Validate file size
      // -----------------------------------------------

      if (
        fileSize <= 0 ||
        fileSize > MAX_FILE_SIZE
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Maximum file size is 50 MB'
          }
        );
      }


      // -----------------------------------------------
      // Verify sender
      // -----------------------------------------------

      const sender = getUser(socket.id);

      if (
        !sender ||
        sender.userId !== senderId
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Unauthorized sender'
          }
        );
      }


      // -----------------------------------------------
      // Find receiver
      // -----------------------------------------------

      const receiver =
        getUserByUserId(receiverId);

      if (!receiver) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Receiver is offline'
          }
        );
      }


      const receiverSocket =
        io.sockets.sockets.get(
          receiver.id
        );

      if (!receiverSocket) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Receiver is offline'
          }
        );
      }


      // -----------------------------------------------
      // Duplicate upload
      // -----------------------------------------------

      if (fileTransfers.has(uploadId)) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Upload already exists'
          }
        );
      }


      // -----------------------------------------------
      // Store metadata ONLY
      // -----------------------------------------------

      fileTransfers.set(
        uploadId,
        {
          uploadId,

          senderId,
          senderSocketId: socket.id,

          receiverId,
          receiverSocketId: receiver.id,

          fileName,
          fileSize,
          fileType:
            fileType ||
            'application/octet-stream',

          nextChunkIndex: 0,
          receivedBytes: 0,

          waitingForReceiverAck: false,

          createdAt: Date.now()
        }
      );


      // -----------------------------------------------
      // Notify receiver
      // -----------------------------------------------

      receiverSocket.emit(
        'fileStart',
        {
          uploadId,
          senderId,
          fileName,
          fileSize,
          fileType:
            fileType ||
            'application/octet-stream'
        }
      );


      // -----------------------------------------------
      // Notify sender
      // -----------------------------------------------

      socket.emit(
        'fileStartAck',
        {
          uploadId,
          chunkSize: MAX_CHUNK_SIZE
        }
      );

    } catch (error) {

      console.error(
        'fileStart error:',
        error
      );

      socket.emit(
        'fileError',
        {
          uploadId: data.uploadId,
          error: 'Failed to start file transfer'
        }
      );
    }
  });


  // ====================================================
  // FILE CHUNK
  // ====================================================

  socket.on('fileChunk', (data = {}) => {

    try {

      const {
        uploadId,
        chunkIndex,
        chunk
      } = data;


      const transfer =
        fileTransfers.get(uploadId);


      if (!transfer) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Upload not found'
          }
        );
      }


      // -----------------------------------------------
      // Verify sender
      // -----------------------------------------------

      if (
        transfer.senderSocketId !== socket.id
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Unauthorized sender'
          }
        );
      }


      // -----------------------------------------------
      // Only one chunk in flight
      // -----------------------------------------------

      if (
        transfer.waitingForReceiverAck
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error:
              'Previous chunk has not been acknowledged'
          }
        );
      }


      // -----------------------------------------------
      // Validate chunk order
      // -----------------------------------------------

      if (
        chunkIndex !==
        transfer.nextChunkIndex
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error:
              `Expected chunk ${transfer.nextChunkIndex}`
          }
        );
      }


      // -----------------------------------------------
      // Validate chunk
      // -----------------------------------------------

      if (!chunk) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Empty chunk'
          }
        );
      }


      const chunkSize =
        Buffer.isBuffer(chunk)
          ? chunk.length
          : chunk.byteLength;


      if (
        chunkSize <= 0 ||
        chunkSize > MAX_CHUNK_SIZE
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Invalid chunk size'
          }
        );
      }


      // -----------------------------------------------
      // Check total file size
      // -----------------------------------------------

      if (
        transfer.receivedBytes +
        chunkSize >
        transfer.fileSize
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'File size exceeded'
          }
        );
      }


      // -----------------------------------------------
      // Get receiver
      // -----------------------------------------------

      const receiverSocket =
        io.sockets.sockets.get(
          transfer.receiverSocketId
        );


      if (!receiverSocket) {

        fileTransfers.delete(uploadId);

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Receiver disconnected'
          }
        );
      }


      // -----------------------------------------------
      // Mark waiting for receiver ACK
      // -----------------------------------------------

      transfer.waitingForReceiverAck = true;


      // -----------------------------------------------
      // FORWARD CHUNK
      //
      // The server does NOT save the chunk.
      // -----------------------------------------------

      receiverSocket.emit(
        'fileChunk',
        {
          uploadId,
          chunkIndex,
          chunk
        }
      );

    } catch (error) {

      console.error(
        'fileChunk error:',
        error
      );

      socket.emit(
        'fileError',
        {
          uploadId: data.uploadId,
          error: 'Failed to process file chunk'
        }
      );
    }
  });


  // ====================================================
  // RECEIVER CHUNK ACK
  // ====================================================

  socket.on(
    'fileChunkReceived',
    (data = {}) => {

      const {
        uploadId,
        chunkIndex,
        chunkSize
      } = data;


      const transfer =
        fileTransfers.get(uploadId);


      if (!transfer) {
        return;
      }


      // -----------------------------------------------
      // Only receiver can ACK
      // -----------------------------------------------

      if (
        transfer.receiverSocketId !==
        socket.id
      ) {

        return;
      }


      // -----------------------------------------------
      // Validate chunk index
      // -----------------------------------------------

      if (
        chunkIndex !==
        transfer.nextChunkIndex
      ) {

        return;
      }


      // -----------------------------------------------
      // Validate chunk size
      // -----------------------------------------------

      if (
        !Number.isInteger(chunkSize) ||
        chunkSize <= 0 ||
        chunkSize > MAX_CHUNK_SIZE
      ) {

        return;
      }


      // -----------------------------------------------
      // Update transfer
      // -----------------------------------------------

      transfer.receivedBytes +=
        chunkSize;

      transfer.nextChunkIndex++;

      transfer.waitingForReceiverAck =
        false;


      // -----------------------------------------------
      // Get sender
      // -----------------------------------------------

      const senderSocket =
        io.sockets.sockets.get(
          transfer.senderSocketId
        );


      if (!senderSocket) {

        fileTransfers.delete(
          uploadId
        );

        return;
      }


      // -----------------------------------------------
      // Tell sender to send next chunk
      // -----------------------------------------------

      senderSocket.emit(
        'fileChunkAck',
        {
          uploadId,
          chunkIndex,

          receivedBytes:
            transfer.receivedBytes,

          progress:
            Math.round(
              (
                transfer.receivedBytes /
                transfer.fileSize
              ) * 100
            )
        }
      );
    }
  );


  // ====================================================
  // FILE END
  // ====================================================

  socket.on(
    'fileEnd',
    (data = {}) => {

      const {
        uploadId
      } = data;


      const transfer =
        fileTransfers.get(uploadId);


      if (!transfer) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Upload not found'
          }
        );
      }


      // Only sender
      if (
        transfer.senderSocketId !==
        socket.id
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Unauthorized sender'
          }
        );
      }


      // Last chunk must be ACKed
      if (
        transfer.waitingForReceiverAck
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error:
              'Last chunk has not been acknowledged'
          }
        );
      }


      // Make sure entire file arrived
      if (
        transfer.receivedBytes !==
        transfer.fileSize
      ) {

        return socket.emit(
          'fileError',
          {
            uploadId,
            error:
              'File transfer incomplete'
          }
        );
      }


      const receiverSocket =
        io.sockets.sockets.get(
          transfer.receiverSocketId
        );


      if (!receiverSocket) {

        fileTransfers.delete(
          uploadId
        );

        return socket.emit(
          'fileError',
          {
            uploadId,
            error: 'Receiver disconnected'
          }
        );
      }


      // Tell receiver file is complete
      receiverSocket.emit(
        'fileEnd',
        {
          uploadId,

          fileName:
            transfer.fileName,

          fileSize:
            transfer.fileSize,

          fileType:
            transfer.fileType
        }
      );


      // Tell sender
      socket.emit(
        'fileComplete',
        {
          uploadId
        }
      );


      // Remove metadata
      fileTransfers.delete(
        uploadId
      );
    }
  );


  // ====================================================
  // CANCEL FILE
  // ====================================================

  socket.on(
    'fileCancel',
    (data = {}) => {

      const {
        uploadId
      } = data;


      const transfer =
        fileTransfers.get(uploadId);


      if (!transfer) {
        return;
      }


      // Only sender or receiver
      // can cancel
      if (
        transfer.senderSocketId !==
          socket.id &&
        transfer.receiverSocketId !==
          socket.id
      ) {

        return;
      }


      const otherSocketId =
        transfer.senderSocketId === socket.id
          ? transfer.receiverSocketId
          : transfer.senderSocketId;


      const otherSocket =
        io.sockets.sockets.get(
          otherSocketId
        );


      if (otherSocket) {

        otherSocket.emit(
          'fileCancel',
          {
            uploadId
          }
        );
      }


      fileTransfers.delete(
        uploadId
      );
    }
  );




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
