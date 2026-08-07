const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
dotenv.config();

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const cookieRoutes = require('./cookies/routes');
const { cookieConsentMiddleware } = require('./cookies/middleware');
const path = require('path');

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(cookieConsentMiddleware);

// serve public static
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'index.html')));
app.use('/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api/cookies', cookieRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));
