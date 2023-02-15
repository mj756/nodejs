const apiResponse = require('../helper/ApiResponse');
const mongoose = require('mongoose');
require('dotenv').config();
const userModel = require('../models/user');
mongoose.set('strictQuery', false);
class DataManager {

    static async createUser() {
        try {
            var dbName = process.env.DB_NAME;
            var dbUserName = process.env.DB_USER;
            var dbPassword = process.env.DB_PASSWORD;
            var response = new apiResponse();
            await mongoose.connect("mongodb+srv://" + dbUserName + ":" + dbPassword + "@mycluster.dhani.mongodb.net/" + dbName + "?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true });
            const user = new userModel({
                empName: "milan",
                empEmail: "test@gmail.com",
            });
            let result = await user.save();
            response.data = result;
        } catch (e) {
            console.log(e);
            response.message = e;
        }
        return response;
    }

}

module.exports = DataManager;