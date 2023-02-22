const { mongoose, Schema } = require('mongoose');

const chatSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true,
    },
    receiver: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    insertedOn: {
        type: Date,
        required: true
    },
}, {
    collection: 'messages',
    versionKey: false
});
const chat = mongoose.model('messages', chatSchema);
module.exports = chat;