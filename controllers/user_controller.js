const dataManager = require('../Repository/DataManager');
class UsersController {
    constructor() {

    }
    static async createUser(req, res) {
        try {
            let userDetail = {
                name: req.body.name,
                email: req.body.email,
                password: req.body.password
            }
            var data = await dataManager.createUser(userDetail);
            res.status(200).json(data).send();
        } catch (e) {
            console.log(e);
            res.status(500).json({ status: 1, message: res.__('error'), data: null }).send();
        }
    }
    static async getuser(req, res) {
        try {
            var data = await dataManager.getAllUser();
            res.status(200).json(data).send();
        } catch (e) {
            res.status(500).json({ status: 1, message: res.__('error'), data: null }).send();
        }
    }
    static async getSpecificUser(req, res) {
        try {
            var data = await dataManager.getSpecificUser(req.params.id);
            res.status(200).json(data).send();
        } catch (e) {
            res.status(500).json({ status: 1, message: res.__('error'), data: null }).send();
        }
    }

    static async login(req, res) {
        try {
            let userDetail = {
                email: req.body.email,
                password: req.body.password
            }
            var data = await dataManager.login(userDetail);
            res.status(200).json(data).send();
        } catch (e) {
            console.log(e);
            res.status(500).json({ status: 1, message: res.__('error'), data: null }).send();
        }
    }
    static logout(req, res) {
        try {
            res.status(200).json(req.body).send();
        } catch (e) {
            res.status(500).json({ status: 1, message: res.__('error'), data: null }).send();
        }
    }
    static forgotPassword(req, res) {
        try {
            res.status(200).data(req.body).send();
        } catch (e) {
            res.status(500).json({ status: 1, message: res.__('error'), data: null }).send();
        }
    }
}
module.exports = UsersController;