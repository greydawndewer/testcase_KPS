const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    email: { type: String },
    pfp: { type: String },
    pn: { type: String },
    password: { type: String, required: true },
    name: { type: String, required: true, unique: true },
    role: { type: String, enum: ['consumer', 'producer'], required: true },
    producer: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Producer' }] // Reference to Producer if the user is a producer
});

const User = mongoose.model('User', userSchema);
module.exports = User;
