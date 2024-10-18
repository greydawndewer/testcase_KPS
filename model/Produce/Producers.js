const producerSchema = new mongoose.Schema({});
producerSchema.add({
    company: {
        name: {type: String, required: true} ,
        products:[{ type: Schema.Types.ObjectId, ref: 'Product' }],

    } 
});

const Producer = mongoose.model('Producer', producerSchema);
