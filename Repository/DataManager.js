const apiResponse = require('../helper/ApiResponse');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const userModel = require('../models/user');
const chatModel = require('../models/chat');
const userDevices = require('../models/user_devices');
//const dbClient = require('./connection');
const logger = require('../helper/Logger');
const socket = require('socket.io');
var users = [];
class DataManager {

    static setSocket(server) {
        this.io = (socket)(server);
        const io = this.io;

        io.on('connection', function (socket) {
            if (this.socket == null) {
                this.socket = socket;
            }

            socket.on('joinroom', () => {
                socket.join('group');
            });
            socket.on('userReady', async (userDetail) => {
                users.push({ id: userDetail.id, socketId: socket.id, name: userDetail.name, profileImage: userDetail.profileImage });
                var userList = users.filter(e => e.socketId != socket.id);
                if (userList != null && userList.length > 0) {
                    io.to(socket.id).emit('userList', userList);
                }
                socket.broadcast.emit('newUser', { id: userDetail.id, socketId: socket.id, name: userDetail.name, profileImage: userDetail.profileImage });
            })
            socket.on('getMessage', async function (message) {
                var result = await DataManager.getMessageBetweenTwoPerson(message);
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
            socket.on('groupMessage', async function (data) {

                socket.broadcast.to('group').emit('message', data);
            })
            socket.on('message', async function (data) {
                var model = new chatModel({
                    sender: data.sender,
                    receiver: data.receiver,
                    message: data.message,
                    messageType: 'text',
                    insertedOn: new Date(new Date().toUTCString())
                })
                let chat = {
                    _id: model._id,
                    sender: data.sender,
                    receiver: data.receiver,
                    message: data.message,
                    messageType: 'text',
                    insertedOn: model.insertedOn
                }
                var index = users.findIndex((obj) => obj.id == data.receiver);
                if (index != null && index >= 0) {
                    io.to(users[index].socketId).emit('message', chat);
                    //  const obj = await dbClient.connect();
                    await model.save();
                    //   obj.close();
                }
            })

            socket.on('loginRequest', async (data) => {
                let userDetail = {
                    email: data.email,
                    password: data.password
                }
                var result = await DataManager.login(userDetail);
                io.to(socket.id).emit('loginResult', result
                );
            })
            socket.on('registerRequest', async (data) => {
                let userDetail = {
                    name: data.name,
                    email: data.email,
                    password: data.password,

                }
                var result = await DataManager.createUser(userDetail);
                io.to(socket.id).emit('registerResult', result
                );
            })
        });
    }

    static async login(userDetail) {
        try {
            var response = new apiResponse();
            // const obj = await dbClient.connect();
            var result = await userModel.findOne({ 'email': userDetail.email, 'password': userDetail.password }).select('name email profileImage');

            if (result != null) {
                const device = new userDevices({
                    fcm: 'fcm token',
                    user: result._id,
                    insertedOn: new Date(new Date().toUTCString())
                });
                let deviceResult = await device.save();
                await userModel.findOneAndUpdate({
                    'email': userDetail.email
                }, {
                    $push: {
                        devices: deviceResult._id
                    }
                }
                );
                let token = jwt.sign({ result }, process.env.JWT_SECRET, {
                    algorithm: process.env.AUTH_ALGO,
                    expiresIn: '1 day'
                });
                response.data = { user: result, token: token };
            } else {
                response.message = "Invalid credential";
            }
            //  obj.close();
            response.status = result == null ? 1 : 0;

        } catch (e) {
            logger.error(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }
    static async createUser(userDetail) {
        try {
            var response = new apiResponse();
            const user = new userModel({
                name: userDetail.name,
                email: userDetail.email,
                password: userDetail.password,
                profileImage: 'http://192.168.21.7:3000/user-icon.png',
                insertedOn: new Date(new Date().toUTCString())
            });
            //  const obj = await dbClient.connect();
            let result = await user.save();
            //  obj.close();
            let token = jwt.sign({ result }, process.env.JWT_SECRET, {
                algorithm: process.env.AUTH_ALGO,
                expiresIn: '1 day'
            });
            response.data = { user: result, token: token };
        } catch (e) {
            logger.error(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }
    static async getAllUser() {
        var response = new apiResponse();
        try {
            // const obj = await dbClient.connect();
            let result = await userModel.find({}).select('name email');
            //  obj.close();
            response.data = result;
        } catch (e) {
            logger.error(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }

    static async getSpecificUser(id) {
        try {
            var response = new apiResponse();
            //  const obj = await dbClient.connect();
            let result = await userModel.findById(id).select('name email');
            // obj.close();
            response.data = result;
        } catch (e) {
            logger.error(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }

    static async sendEndToEndFile(messageDetail, isGroupMessage = false) {
        try {
            var response = new apiResponse();
            const chat = new chatModel({
                sender: messageDetail.sender,
                receiver: messageDetail.receiver,
                message: messageDetail.message,
                insertedOn: new Date(new Date().toUTCString()),
                messageType: messageDetail.messageType,
            });
            if (isGroupMessage == true) {
                this.io.to('group').emit('message', chat);
            } else {
                var index = users.findIndex((obj) => obj.id == chat.receiver);
                if (index != null && index >= 0) {
                    this.io.to(users[index].socketId).emit('message', chat);
                }
            }

            //  const obj = await dbClient.connect();
            response.data = await chat.save();
            //  obj.close();
        } catch (e) {
            logger.error(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }


    static async getMessageBetweenTwoPerson(messageDetail) {
        var response = new apiResponse();
        try {
            //   const obj = await dbClient.connect();
            var result = await chatModel.find({
                $or: [
                    { $and: [{ sender: messageDetail.user1 }, { receiver: messageDetail.user2 }] },
                    { $and: [{ sender: messageDetail.user2 }, { receiver: messageDetail.user1 }] }
                ]
            }).select('sender receiver message messageType insertedOn').sort({ insertedOn: 1 });
            response.data = result;
            //   obj.close();
        } catch (e) {
            logger.error(e.stack);
            console.log(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }
}
module.exports = DataManager;