const consumerSchema = new mongoose.Schema({});
consumerSchema.add({
    cart: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    address: [{
        type: String,
        required: true
    }]
});

const Consumer = mongoose.model('Consumer', consumerSchema);