var mongoose = require('mongoose')
require('dotenv').config();
mongoose.set('strictQuery', false);
const logger = require('../helper/Logger');
const connect = async function () {
    try {
        const dbName = process.env.DB_NAME;
        const dbUserName = process.env.DB_USER;
        const dbPassword = process.env.DB_PASSWORD;
        mongoose.connect("mongodb+srv://" + dbUserName + ":" + dbPassword + "@mycluster.dhani.mongodb.net/" + dbName + "?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true });
        const db = mongoose.connection;
        db.on("error", console.error.bind(console, "connection error: "));
        db.once("open", function () {
            console.log("Connected successfully");
        });
        db.once("close", function () {
            console.log("Connected closed");
        });
        // return mongoose.connection;
    } catch (e) {
        logger.debug(e);
    }
};
connect();
module.export = connect;


