/* ****************************************************************************
 *                                                                             *
 * Lifeguide Toolbox Server                                                    *
 *                                                                             *
 * Copyright (c) 2016                                                          *
 * University of Southampton                                                   *
 *     Author: Petros Papadopoulos                                             *
 *     e-mail: p.papadopoulos@soton.ac.uk                                      *
 *     Created: 11/1/2016                                                      *
 *     Last Modified: xx/x/2016                                                *
 * All rights reserverd                                                        *
 *                                                                             *
 **************************************************************************** */

// =======================
// get the packages we need ============
// =======================
var express     = require('express'); // A web application framework with features for web and mobile apps
var app         = express();
var bodyParser  = require('body-parser'); // A body parser for node.js
var morgan      = require('morgan'); // Morgan is an HTTP request logger for node.js
var mongoose    = require('mongoose');
var passport    = require('passport');
//var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var jwt     = require('jwt-simple');
//var config = require('./config'); // get our config file
var config = require('./config/database');
var User   = require('./app/models/user'); // get our mongoose model
var fs = require('fs');

// Load local JSON intervention for testing purposes ***** NOT using authentication services
var jsonModel = JSON.parse(fs.readFileSync('resources/lgtbdemo.json', 'utf8'));
var sample1Model = JSON.parse(fs.readFileSync('resources/sample1.json', 'utf8'));
var sample2Model = JSON.parse(fs.readFileSync('resources/sample2.json', 'utf8'));
var sample3Model = JSON.parse(fs.readFileSync('resources/sample3.json', 'utf8'));

// =======================
// configuration =========
// =======================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
mongoose.connect(config.database); // connect to database

// Check if we successfully connected in the db
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('Successfully conected to the MongoDB database');
});

app.set('superSecret', config.secret); // Secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Use morgan to log requests to the console
app.use(morgan('dev')); // You can also use 'combined', 'common', 'short', 'tiny'

// Initialise the passport package
app.use(passport.initialize());

// pass passport for configuration
require('./config/passport')(passport); // get error when trying to import passport strategy from configuration file


// =======================
// routes ================
// =======================
// basic route
app.get('/', function(req, res) {
    res.send('Hello! The API is at http://localhost:' + port + '/api');
});

// Basic route used for testing only
app.get('/resources/Jmodel', function (req, res) {
    res.jsonp(jsonModel);
});

// Basic route used for testing only
app.get('/resources/sample1Model', function (req, res) {
    res.jsonp(sample1Model);
});

// Basic route used for testing only
app.get('/resources/sample2Model', function (req, res) {
    res.jsonp(sample2Model);
});

// Basic route used for testing only
app.get('/resources/sample3Model', function (req, res) {
    res.jsonp(sample3Model);
});

// Set up a JWT RESTfull (Representational State Transfer) API strategy for user authentication
// API ROUTES -------------------
// get an instance of the router for api routes
var apiRoutes = express.Router();

// Route to authenticate a user (POST http://localhost:8080/api/authenticate)
apiRoutes.post('/authenticate', function (req, res) {
    User.findOne({
        username: req.body.username
    }, function (err, user) {
        if (err) throw err;

        if (!user) {
            res.send({
                success: false,
                msg: 'Authentication failed. User not found.'
            });
        } else {
            // check if password matches
            user.comparePassword(req.body.password, function (err, isMatch) {
                if (isMatch && !err) {
                    // if user is found and password is right create a token
                    var token = jwt.encode(user, config.secret);

                    // This JWT is using a different jwt library than the example
                    // Respond to a successful authntication attempt with a JWT token
                    /*
                    var expires = moment().add('days', 120).valueOf();
                    var expires = '1478829722'; //Unix timestamp equivalent to 11/11/2016 @ 2:02am (UTC)
                    var token = jwt.encode({
                        iss: user.username,
                        exp: expires
                    }, app.get('jwtTokenSecret'));

                    res.json({
                        token: token,
                        expires: expires,
                        user: user.toJSON()
                    });
                    //*/

                    // return the information including token as JSON
                    //*
                    res.json({
                        success: true,
                        token: 'JWT ' + token
                    });
                    //*/
                } else {
                    res.send({
                        success: false,
                        msg: 'Authentication failed. Wrong password.'
                    });
                }
            });
        }
    });
});

// Route to create a new user account (POST http://localhost:8080/api/signup)
apiRoutes.post('/signup', function(req, res) {
  if (!req.body.username || !req.body.password) {
    res.json({success: false, msg: 'Please pass user name and password.'});
  } else {
    var newUser = new User({
      username: req.body.username,
      password: req.body.password
    });
    // save the user
    newUser.save(function(err) {
      if (err) {
        return res.json({success: false, msg: 'Username already exists.'});
      }
      res.json({success: true, msg: 'Successful created new user.'});
    });
  }
});

// Protected route using JWT to a restricted info (GET http://localhost:8080/api/memberinfo)
apiRoutes.get('/memberinfo', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          res.json({success: true, msg: 'Welcome in the member area ' + user.name + '!'});
        }
    });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});

var getToken = function (headers) {
  if (headers && headers.authorization) {
    var parted = headers.authorization.split(' ');
    if (parted.length === 2) {
      return parted[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
};

// TODO: route middleware to verify a token

// route to show a random message (GET http://localhost:8080/api/)
apiRoutes.get('/', function(req, res) {
  res.json({ message: 'Welcome to the coolest API on earth!' });
});

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    res.json(users);
  });
});

// Apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

// =======================
// start the server ======
// =======================
app.listen(port);
console.log('The server is running at http://localhost:' + port);
