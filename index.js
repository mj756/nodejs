var express = require("express");
const bodyParser = require('body-parser');
var path = require("path");
var cors = require("cors");
const userRoute = require('./routes/user');
var app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

app.use('/user', userRoute);

app.get('/', (req, res) => {
    res.send('Hello World, from express');
});
app.listen(3000, () => console.log(`Hello world app listening on port ${3000}!`))
module.exports = app;