const express = require("express");
const bodyParser = require('body-parser');
const path = require("path");
const cors = require("cors");
const userRoute = require('./routes/user');
const app = express();
const auth = require('./middlewares/auth');
const { I18n } = require('i18n');
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

const i18n = new I18n({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    directory: './localization'
});
app.use(i18n.init);

app.use(function (req, res, next) {
    i18n.setLocale(req, req.headers['language']);
    next();
});


app.use('/api/', auth);
app.use('/api/user', userRoute);

app.get('/', (req, res) => {
    res.send(res.__('message'));
});
app.listen(3000, () => console.log(`Hello world app listening on port ${3000}!`))
module.exports = app;