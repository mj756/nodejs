const socket = require('socket.io');
//const dataManager = require('../Repository/DataManager');
var users = [];
const chatModel = require('../models/chat');

module.exports = class SocketObject {

    constructor(server) {
        this.io = (socket)(server);
        this.configure();
    }

    test(data) {
        var index = users.findIndex((obj) => obj.id == data.receiver);

        if (index != null && index >= 0) {
            console.log(data.message);
            console.log(users[index].socketId);
            this.io.to(users[index].socketId).emit('fileMessage', data.message);
        }
    }

    configure() {
        const io = this.io;
        io.on('connection', function (socket) {
            console.log('user connected');
            socket.on("fileUpload", (file) => {
                io.to(socket.id).emit('fileMessage', 'https://www.learningcontainer.com/wp-content/uploads/2020/08/Sample-Small-Image-PNG-file-Download.png');
            });

            socket.on('joinroom', (username, room) => {
                socket.join(room);
                socket.emit('message', 'Welcome to chatcord!');
                //broadcast
                socket.broadcast.to(room).emit('message', `${username} has joined`);

                //send users and room info
                /*  io.to(user.room).emit('roomusers', {
                      room: room,
                      users: getRoomUsers(user.room)
                  });*/
            });
            socket.on('userReady', async (userDetail) => {
                users.push({ id: userDetail.id, socketId: socket.id, name: userDetail.name });
                var userList = users.filter(e => e.socketId != socket.id);
                if (userList != null && userList.length > 0) {
                    io.to(socket.id).emit('userList', userList);
                }
                socket.broadcast.emit('newUser', { id: userDetail.id, socketId: socket.id, name: userDetail.name });
            })
            socket.on('getMessage', async function (message) {
                // var result = await dataManager.getMessageBetweenTwoPerson(message);
                /*if (result.data != null) {
                    io.to(socket.id).emit('oldMessages', result.data);
                }*/
            })
            socket.on('disconnect', () => {
                var index = users.findIndex((obj) => obj.socketId == socket.id);
                if (index != null && index >= 0) {
                    socket.broadcast.emit('userLeave', { id: users[index].id, socketId: socket.id });
                    users.splice(index, 1);
                }
            })
            socket.on('message', async function (data) {

                var model = new chatModel({
                    sender: data.sender,
                    receiver: data.receiver,
                    message: data.message,
                    insertedOn: new Date(new Date().toUTCString())
                })
                let chat = {
                    _id: model._id,
                    sender: data.sender,
                    receiver: data.receiver,
                    message: data.message,
                    insertedOn: model.insertedOn
                }
                var index = users.findIndex((obj) => obj.id == data.receiver);
                if (index != null && index >= 0) {
                    io.to(users[index].socketId).emit('message', chat);
                    //   await dataManager.sendMessage(model);
                }
            })
            socket.on('loginRequest', async function (data) {
                let userDetail = {
                    email: data.email,
                    password: data.password
                }
                //var result = await dataManager.login(userDetail);
                io.to(socket.id).emit('loginResult', result
                );
            })
        });
    }
}
