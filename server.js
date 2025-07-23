const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require("https");
const comps = require('./routes/sample.js');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
const uri = "mongodb+srv://Ganime_Dewer:jamshedpur_1000@ganimeindustries1000.rkmonvc.mongodb.net/data";
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

app.use('/', comps);


// Start server
app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});