const express = require('express');
const userRouter = express.Router();
const { validationResult } = require('express-validator');
const userController = require("../controllers/user_controller");
const userControllerValidator = require('../validations/user_controller_validator');
userRouter.get("/", userController.getuser);
userRouter.get("/:id", userController.getSpecificUser);
userRouter.post("/register", userControllerValidator.signUpValidation
    , (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                status: 1,
                message: errors.array()[0].msg,
                data: null
            });
        } else {
            userController.createUser(req, res);
        }
    });
userRouter.post("/login", userControllerValidator.loginValidation, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 1,
            message: errors.array()[0].msg,
            data: null
        });
    } else {
        userController.login(req, res);
    }
});
userRouter.post("/logout", userControllerValidator.loginValidation, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 1,
            message: errors.array()[0].msg,
            data: null
        });
    } else {
        userController.logout(req, res);
    }
});
userRouter.post("/forgotpassword", userControllerValidator.emailValidator, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 1,
            message: errors.array()[0].msg,
            data: null
        });
    } else {
        userController.forgotPassword(req, res);
    }
});

module.exports = userRouter;