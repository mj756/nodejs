const dataManager = require('../Repository/DataManager');
class UsersController {
    constructor() {

    }
    static async createUser(req, res) {
        try {
            var data = await dataManager.createUser();

            res.status(200).json(data).send();

        } catch (e) {
            console.log(e);
            res.status(500).json({ status: 1, message: "Server error", data: null }).send();
        }
    }
    static getuser(req, res) {
        try {
            res.status(200).data(req.body).send();
        } catch (e) {
            res.status(500).data(req.body).send();
        }
    }
    static login(req, res) {
        try {
            res.status(200).data(req.body).send();
        } catch (e) {
            res.status(500).data(req.body).send();
        }
    }
    static logout(req, res) {
        try {
            res.status(200).data(req.body).send();
        } catch (e) {
            res.status(500).data(req.body).send();
        }
    }
    static forgotPassword(req, res) {
        try {
            res.status(200).data(req.body).send();
        } catch (e) {
            res.status(500).data(req.body).send();
        }
    }
}
module.exports = UsersController;