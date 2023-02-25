var jwt = require('jsonwebtoken');
module.exports = function (req, res, next) {
    const ignoreRoutes = [
        "/user/login", "/user/register", "/user/forgotpassword", "/user/upload"
    ];
    if (ignoreRoutes.indexOf(req.url) >= 0) {
        next();
    }
    else {
        if (req.headers.hasOwnProperty('authorization')) {
            try {
                req.user = jwt.verify(req.headers['authorization'], process.env.JWT_SECRET);
            } catch (err) {
                return res.status(401).json({
                    error: {
                        msg: res.__('invalid_authorization')
                    }
                });
            }
        } else {
            return res.status(401).json({
                error: {
                    msg: res.__('invalid_authorization')
                }
            });
        }
        next();
    }
};