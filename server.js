var express = require('express');
var app = express();
var path = require('path');
var mongoose = require('mongoose');
var Twitter = require('node-twitter-api');
var session = require('express-session');
var FileStore = require('session-file-store')(session);
require('express-helpers')(app);
app.enable('trust proxy');
var port = process.env.PORT || 3000;

// get credentials from config file in dev, or from heroku env in deployment
if(port === 3000) {
	var config = require('./config.js');
} else {
	var config = {
		mongooseUsername: process.env.mongooseUsername,
		mongoosePassword: process.env.mongoosePassword,
		twitterConsumerKey: process.env.twitterConsumerKey,
		twitterConsumerSecret: process.env.twitterConsumerSecret,
		callbackUrl: process.env.callbackUrl
	};
}

app.set('view engine', 'ejs');

var sessionOptions = {
	secret: config.sessionSecret,
	saveUninitialized: true,
	resave: false,
	store: new FileStore(),
	name: 'my.connect.sid'
};

// middleware
app.use(session(sessionOptions));
app.use('/public', express.static(path.join(__dirname, 'public')));

// begin app
app.listen(port, function(req, res) {
	console.log('listening on 3000');
});

app.get('/', function(req, res) {
	res.render('index.ejs', {bars: 'bars', userInfo: ''});
});