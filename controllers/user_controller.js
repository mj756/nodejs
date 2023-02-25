const dataManager = require('../Repository/DataManager');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

class UsersController {

    static async createUser(req, res) {
        try {
            let userDetail = {
                name: req.body.name,
                email: req.body.email,
                profileImage: req.protocol + '://' + req.hostname + ':' + process.env.PORT + '/user-icon.png',
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
    static uploadFile(req, res) {
        try {
            const form = new formidable.IncomingForm();
            form.parse(req, async function (err, fields, files) {
                var paths = __dirname.split('\\');
                paths[paths.length - 1] = 'uploads';
                paths = paths.join('\\');
                var rawData = fs.readFileSync(files.file.filepath)
                var newPath = path.join(paths, files.file.originalFilename);

                fs.writeFile(newPath, rawData, function (err) {
                    if (err) console.log(err)
                    return res.send("Successfully uploaded")
                })
                let messageType = '';
                const extenstion = files.file.originalFilename.substring(files.file.originalFilename.lastIndexOf('.') + 1);

                if (['jpg', 'jpeg', 'png'].indexOf(extenstion) >= 0) {
                    messageType = 'image';
                } else if (['mkv', 'mp4', 'flv', 'wmv'].indexOf(extenstion) >= 0) {
                    messageType = 'video';
                } else if (extenstion == "mp3") {
                    messageType = 'audio';
                } else if (['pdf', 'docx', 'txt'].indexOf(extenstion) >= 0) {
                    messageType = 'doc';
                } else {
                    messageType = 'file';
                }

                var msg = {
                    sender: fields.sender,
                    receiver: fields.receiver,
                    message: req.protocol + '://' + req.hostname + ':' + process.env.PORT + '/' + files.file.originalFilename,
                    messageType: messageType
                }
                const isGroupMessage = fields.groupId == null ? false : true;
                await dataManager.sendEndToEndFile(msg, isGroupMessage);
            })
        } catch (e) {
            res.status(500).json({ status: 1, message: res.__('error'), data: null }).send();
        }
    }
}
module.exports = UsersController;