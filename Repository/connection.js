var mongoose = require('mongoose')
require('dotenv').config();
mongoose.set('strictQuery', false);
const logger = require('../helper/Logger');
module.exports.connect = async function () {
    try {
        const dbName = process.env.DB_NAME;
        const dbUserName = process.env.DB_USER;
        const dbPassword = process.env.DB_PASSWORD;

        await mongoose.connect("mongodb+srv://" + dbUserName + ":" + dbPassword + "@mycluster.dhani.mongodb.net/" + dbName + "?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true });
        return mongoose.connection;
    } catch (e) {
        logger.debug(e.stack);
    }
};
//mongodb://localhost:27017



