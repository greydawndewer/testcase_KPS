const mongoose = require('mongoose');
const producerSchema = new mongoose.Schema({
    company: {
        name: {type: String, required: true} ,
        products:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    }
});

const Producer = mongoose.model('Producer', producerSchema);
module.exports = Producer;

