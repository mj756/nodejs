const socket = require('socket.io');
const dataManager = require('../Repository/DataManager');
var users = [];
module.exports = function configure(server) {
    const io = (socket)(server);
    io.on('connection', function (socket) {
        socket.on('userReady', (userId) => {
            users.push({ id: userId, socketId: socket.id });
            io.to(socket.id).emit('userList', users.filter(e => e.socketId != socket.id));
            socket.broadcast.emit('newUser', { id: userId, socketId: socket.id });
        })
        socket.on('disconnect', () => {
            console.log('user disconnected');
            var index = users.findIndex((obj) => obj.socketId == socket.id);
            console.log(index);
            if (index != null && index >= 0) {
                socket.broadcast.emit('userLeave', { id: users[index].id, socketId: socket.id });
                users.splice(index, 1);
            }
        })

        socket.on('message', (data) => {
            // io.sockets.emit('message', data);
            socket.broadcast.emit('message', data);
        })
        socket.on('loginRequest', async function (data) {
            console.log(data);
            let userDetail = {
                email: data.email,
                password: data.password
            }
            var result = await dataManager.login(userDetail);

            io.to(socket.id).emit('loginResult', result
            );
        })
    });
}