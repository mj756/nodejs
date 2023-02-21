const { mongoose, Schema } = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
    },
    insertedOn: {
        type: Date,
        required: true
    },
    devices: [{ type: Schema.Types.ObjectId, ref: 'devices' }]
}, {
    collection: 'users',
    versionKey: false
});
const user = mongoose.model('users', userSchema);
module.exports = user;