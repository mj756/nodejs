const { mongoose } = require('mongoose');

const userSchema = new mongoose.Schema({

    empName: {
        type: String,
        required: true,
    },
    empEmail: {
        type: String,
        required: true,
        unique: true
    },
}, {
    collection: 'users',
    versionKey: false
});
const user = mongoose.model('users', userSchema);
module.exports = user;