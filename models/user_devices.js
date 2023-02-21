const { mongoose, Schema } = require('mongoose');

const userDevices = new mongoose.Schema({
    fcm: {
        type: String,
        required: true,
    },
    insertedOn: {
        type: Date,
        required: true
    },
    user: { type: Schema.Types.ObjectId, ref: 'users' },
}, {
    collection: 'devices',
    versionKey: false
});
const user = mongoose.model('devices', userDevices);
module.exports = user;