const { check} = require('express-validator');
const signUpValidation = [
    check('email', 'Email is not valid').isEmail(),
    check('email', 'Email is not valid').not().isEmpty(),
    check('name', 'Please provide valid user name').not().isEmpty(),
    check('name', 'Name is not valid').isAlpha(),
    check('password', 'Password is not valid').not().isEmpty(),
    check('password', 'Password must be minimum 10 character long').isLength({ min: 10, max: 20 }),
];
const loginValidation = [
    check('email', 'Email is not valid').isEmail(),
    check('email', 'Email is not valid').not().isEmpty(),
    check('password', 'Password is not valid').not().isEmpty(),
    check('password', 'Password must be minimum 10 character long').isLength({ min: 10, max: 20 }),
];

const userIdValidator = [
    check('id', 'User id is not valid').isNumeric(),
    check('id', 'User id is not valid').not().isEmpty(),
];
const emailValidator = [
    check('email', 'Email is not valid').isEmail(),
    check('email', 'Email is not valid').not().isEmpty(),
];
module.exports = {signUpValidation,loginValidation,userIdValidator,emailValidator}