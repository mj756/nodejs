const apiResponse = require('../helper/ApiResponse');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const userModel = require('../models/user');
const dbClient = require('./connection');
const logger = require('../helper/Logger');
class DataManager {


    static async login(userDetail) {
        try {
            var response = new apiResponse();

            // const obj = await dbClient();
            var result = await userModel.findOne({ 'email': userDetail.email, 'password': userDetail.password });
            //  obj.close();
            if (result != null) {
                let token = jwt.sign({ result }, process.env.JWT_SECRET, {
                    algorithm: process.env.AUTH_ALGO,
                    expiresIn: '1 day'
                });
                response.data = { user: result, token: token };
            } else {
                response.message = "Invalid credential";
            }
            response.status = result == null ? 1 : 0;

        } catch (e) {
            logger.debug(e);
            response.message = e;
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
            });
            let result = await user.save();
            response.data = result;
        } catch (e) {
            logger.debug(e);
            response.message = e;
        }
        return response;
    }
    static async getAllUser() {
        try {
            let result = await userModel.find({});
            response.data = result;
        } catch (e) {
            logger.debug(e);
            response.message = e;
        }
        return response;
    }
    static async getSpecificUser(id) {
        try {
            var response = new apiResponse();
            let result = await userModel.findById(id);
            response.data = result;
        } catch (e) {
            logger.debug(e);
            response.message = e;
        }
        return response;
    }
}
module.exports = DataManager;