const express = require('express');
var cors = require('cors')

const app = express();

app.use(cors())

// middlewares
app.use(express.json());
app.use(express.urlencoded({extended: false}));

// Routes
app.use(require('./routes/index'));

app.listen(5000);
console.log('Server on port', 5000);
