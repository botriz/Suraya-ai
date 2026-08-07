const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => res.send('Suraya YT Automation skeleton: healthy'));
app.use('/auth', authRoutes);
app.use('/api', uploadRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));
