const mongoose = require('mongoose');
const { Schema } = mongoose;

const category = new Schema({
    name : {
      type : String,
      required: true,
      unique: true
    }
});

const User = mongoose.model('Category', category);