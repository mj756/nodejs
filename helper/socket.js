const socket = require('socket.io');
const dataManager = require('../Repository/DataManager');
var users = [];
const chatModel = require('../models/chat');
module.exports = function configure(server) {
    const io = (socket)(server);
    io.on('connection', function (socket) {
        socket.on('userReady', async function (userDetail) {
            users.push({ id: userDetail.id, socketId: socket.id, name: userDetail.name });
            var userList = users.filter(e => e.socketId != socket.id);
            if (userList != null && userList.length > 0) {
                io.to(socket.id).emit('userList', userList);
            }
            socket.broadcast.emit('newUser', { id: userDetail.id, socketId: socket.id, name: userDetail.name });
        })
        socket.on('getMessage', async function (message) {

            var result = await dataManager.getMessageBetweenTwoPerson(message);
            if (result.data != null) {
                io.to(socket.id).emit('oldMessages', result.data);
            }
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
                await dataManager.sendMessage(model);
                /* if (result.status == 0) {
                     io.to(users[index].socketId).emit('message', result.data);
                 }*/
            }
        })
        socket.on('loginRequest', async function (data) {
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