var express = require('express');
var app = express();
var path = require('path');
var mongoose = require('mongoose');
var Twitter = require('node-twitter-api');
var session = require('express-session');
var FileStore = require('session-file-store')(session);
var async = require('async');
require('express-helpers')(app);
app.enable('trust proxy');
var port = process.env.PORT || 3000;
var yelp = require("node-yelp");

// get credentials from config file in dev, or from heroku env in deployment
if(port === 3000) {
	var config = require('./config.js');
} else {
	var config = {
		mongooseUsername: process.env.mongooseUsername,
		mongoosePassword: process.env.mongoosePassword,
		twitterConsumerKey: process.env.twitterConsumerKey,
		twitterConsumerSecret: process.env.twitterConsumerSecret,
		yelpConsumerKey: process.env.yelpConsumerKey,
		yelpConsumerSecret: process.env.yelpConsumerSecret,
		yelpToken: process.env.yelpToken,
		yelpTokenSecret: process.env.yelpTokenSecret,
		callbackUrl: process.env.callbackUrl,
		sessionSecret: process.env.callbackUrl.sessionSecret
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


// twitter oAuth setup
var twitter = new Twitter({
	consumerKey: config.twitterConsumerKey,
	consumerSecret: config.twitterConsumerSecret,
	callback: config.callbackUrl
});

var _requestSecret;

// when a user clicks 'sign in' get a request token from twitter and redirect user to sign in with token
app.get('/request-token', function(req, res) {
	twitter.getRequestToken(function(err, requestToken, requestSecret) {
		if(err) {
			res.status(500).send(err);
		} else {
			_requestSecret = requestSecret;
			res.redirect('https://api.twitter.com/oauth/authenticate?oauth_token=' + requestToken);
		}
	});
});

// when user is sent back from twitter, use results to obtain credentials
app.get('/login/twitter/callback', function(req, res) {
	var requestToken = req.query.oauth_token;
	var verifier = req.query.oauth_verifier;

    twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
        if (err)
            res.status(500).send(err);
        else
            twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
                if (err)
                    res.status(500).send(err);
                else {
                	req.session.userInfo = user;
                	req.session.save(function(err) {
                		if(err) {
                			console.log(err);
                		} else {
                			res.redirect('/');
                		}
                	});
                }
            });
    });
});

// sign out: destroy session and clear cookies
app.get('/sign-out', function(req, res) {
	req.session.destroy(function(err) {
		if(err) {
			console.log(err);
		} else {
			res.clearCookie(sessionOptions.name);
			res.redirect('/');
		}
	})
});

// yelp setup
var client = yelp.createClient({
	oauth: {
		"consumer_key": config.yelpConsumerKey,
		"consumer_secret": config.yelpConsumerSecret,
		"token": config.yelpToken,
		"token_secret": config.yelpTokenSecret
	}
});

// database setup
mongoose.connect('mongodb://' + config.mongooseUsername + ':' + config.mongoosePassword + '@ds017636.mlab.com:17636/party-party');

var barSchema = new mongoose.Schema({
	name: String,
	snippet_text: String,
	id: String,
	image_url: String,
	queries: [String],
	guests: [String],
	attendees: {type: Number, default: 0}
});

var Bar = mongoose.model('Bar', barSchema)

// begin app
app.listen(port, function(req, res) {
	console.log('listening on 3000');
});

app.get('/', function(req, res) {
	res.render('index.ejs', {userInfo: req.session.userInfo});
});

app.get('/api/search/:tagId', function(req, res) {
	var userQuery = req.params.tagId;
	req.session.query = userQuery;

	client.search({
		terms: "bar",
		location: userQuery,
		limit: 10,
		category_filter: 'bars'
	}).then(function (data) {
		var results = data.businesses;


		// asynchronously save results to database
		// wait for this to finish before sending client response
		// so user doesn't break things
		async.each(results, function(result, callback) {

			var query = { id: result.id };
			// only set 'setOnInsert' properties when doing an upsert
			// addToSet will create a queries field with userquery as its element on upsert
			// on update, addToSet will push the value to the array only if the array doesn't already have it
			var update = {
				$setOnInsert: {
					name: result.name,
					image_url: result.image_url,
					snippet_text: result.snippet_text
				},
				$addToSet: { queries: userQuery }
			};
			var options = { upsert: true, new: true, setDefaultsOnInsert: true };

			Bar.findOneAndUpdate(query, update, options, function(err, doc) {
				if(err) {
					// if this is called with an error, the async process stops
					callback(err);
				} else {
					// when all of these are called, the next function is processed
					callback();
				}
			});

		}, function(err) {
			if(err) {
				console.log(err);
			} else {
				// all docs saved
				// add guests array to each results because client expects all data to have that schema
				for(var i = 0; i < results.length; i++) {
					results[i].guests = [];
				}
				res.json(JSON.stringify({ docs: results, userInfo: req.session.userInfo }));
			}
		});
	}).catch(function (err) {
		console.log(err);
	});
});

app.get('/api/query', function(req, res) {

	if(req.session.hasOwnProperty('query') && req.session.query) {
		Bar.find({ queries: req.session.query }, function(err, docs) {
			res.json(JSON.stringify({ docs: docs, userInfo: req.session.userInfo }));
		});
	} else {
		res.send('no');
	}

});

app.get('/api/remove-guest/:tagId', function(req, res) {
	var barId = req.params.tagId;
	var guest = req.session.userInfo.screen_name;
	console.log(barId, guest);

	Bar.findOneAndUpdate({ id: barId }, { $pull: { guests: guest } }, { new: true }, function(err, doc) {
		if(err) {
			console.log(err);
		} else {
			console.log(doc);
			res.send(doc);
		}
	})
});

app.get('/api/add-guest/:tagId', function(req, res) {
	var barId = req.params.tagId;
	var guest = req.session.userInfo.screen_name;

	Bar.findOneAndUpdate({ id: barId }, { $addToSet: { guests: guest } }, { new: true }, function(err, doc) {
		if(err) {
			console.log(err);
		} else {
			res.send(doc);
		}
	})
});