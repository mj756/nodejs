const apiResponse = require('../helper/ApiResponse');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const userModel = require('../models/user');
const chatModel = require('../models/chat');
const userDevices = require('../models/user_devices');
const dbClient = require('./connection');
const logger = require('../helper/Logger');
class DataManager {
    static async refreshToken() {
        try {

        } catch (e) {
            logger.error(e.stack);
        }
    }
    static async login(userDetail) {
        try {
            var response = new apiResponse();
            const obj = await dbClient.connect();
            var result = await userModel.findOne({ 'email': userDetail.email, 'password': userDetail.password }).select('name email');
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
            obj.close();
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
                insertedOn: new Date(new Date().toUTCString())
            });
            const obj = await dbClient.connect();
            let result = await user.save();
            obj.close();
            response.data = result;
        } catch (e) {
            logger.error(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }
    static async getAllUser() {
        var response = new apiResponse();
        try {
            const obj = await dbClient.connect();
            let result = await userModel.find({}).select('name email');
            obj.close();
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
            const obj = await dbClient.connect();
            let result = await userModel.findById(id).select('name email');
            obj.close();
            response.data = result;
        } catch (e) {
            logger.error(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }


    static async sendMessage(messageDetail) {
        try {
            var response = new apiResponse();
            const obj = await dbClient.connect();
            response.data = await messageDetail.save();
            obj.close();
            /* const chat = new chatModel({
                 sender: messageDetail.sender,
                 receiver: messageDetail.receiver,
                 message: messageDetail.message,
                 insertedOn: messageDetail.insertedOn
             });
             const obj = await dbClient.connect();
             let result = await chat.save();
             var msg = {
                 sender: messageDetail.sender,
                 receiver: messageDetail.receiver,
                 message: messageDetail.message,
                 insertedOn: result.insertedOn,
                 _id: result._id
             }
             obj.close();*/
        } catch (e) {
            logger.error(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }
    static async getMessageBetweenTwoPerson(messageDetail) {
        var response = new apiResponse();
        try {
            const obj = await dbClient.connect();
            var result = await chatModel.find({
                $or: [
                    { $and: [{ sender: messageDetail.user1 }, { receiver: messageDetail.user2 }] },
                    { $and: [{ sender: messageDetail.user2 }, { receiver: messageDetail.user1 }] }
                ]
            }).select('sender receiver message insertedOn').sort({ insertedOn: 1 });
            response.data = result;
            obj.close();
        } catch (e) {
            logger.error(e.stack);
            console.log(e.stack);
            response.message = 'Internal server error';
        }
        return response;
    }

}
module.exports = DataManager;