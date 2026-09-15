const express = require('express');
var cors = require('cors')

const app = express();

app.use(cors())

// middlewares
app.use(express.text());
app.use(express.json({ limit: '10mb' })); // una corrida con 2027 manda cientos de filas: el limite de 100kb la rechazaba sin avisar
app.use(express.urlencoded({extended: false}));

// Routes
app.use(require('./routes/index'));

app.listen(5000);
console.log('Server on port', 5000);
