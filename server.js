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
// get the packages needed ============
// =======================
var express = require('express'); // A web application framework with features for web and mobile apps
var app = express();
var bodyParser = require('body-parser'); // A body parser for node.js
var morgan = require('morgan'); // Morgan is an HTTP request logger for node.js
var mongoose = require('mongoose');
var passport = require('passport');
//var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var jwt = require('jwt-simple');
//var config = require('./config'); // get our config file
var config = require('./config/database');
var User = require('./app/models/user'); // get our mongoose model
var DataEntry = require('./app/models/data');
var Intervention = require('./app/models/intervention');
var fs = require('fs');
var http = require('http');
var https = require('https');
var privateKey = fs.readFileSync('sslcert/key.pem', 'utf8');
var certificate = fs.readFileSync('sslcert/server.crt', 'utf8');
var path = require('path'); // A library to serve the index file

// Load local JSON intervention for testing purposes ***** NOT using authentication services
var jsonModel = JSON.parse(fs.readFileSync('resources/lgtbdemo.json', 'utf8'));
var sample1Model = JSON.parse(fs.readFileSync('resources/sample1.json', 'utf8'));
var sample2Model = JSON.parse(fs.readFileSync('resources/sample2.json', 'utf8'));
var sample3Model = JSON.parse(fs.readFileSync('resources/sample3.json', 'utf8'));
var sample4Model = JSON.parse(fs.readFileSync('resources/sample4.json', 'utf8'));
var sample5Model = JSON.parse(fs.readFileSync('resources/sample5.json', 'utf8'));
var sample6Model = JSON.parse(fs.readFileSync('resources/sample6.json', 'utf8'));
var sample7Model = JSON.parse(fs.readFileSync('resources/sample7.json', 'utf8'));
var sample8Model = JSON.parse(fs.readFileSync('resources/sample8.json', 'utf8'));
var sample9Model = JSON.parse(fs.readFileSync('resources/sample9.json', 'utf8'));
var sample10Model = JSON.parse(fs.readFileSync('resources/sample10.json', 'utf8'));
var sample11Model = JSON.parse(fs.readFileSync('resources/sample11.json', 'utf8'));
var sample12Model = JSON.parse(fs.readFileSync('resources/sample12.json', 'utf8'));
var healthyMind = JSON.parse(fs.readFileSync('resources/healthymind.json', 'utf8'));


// =======================
// configuration =========
// =======================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
var httpsport = 8443;
mongoose.connect(config.database); // connect to database

var credentials = {
    key: privateKey,
    cert: certificate
};

// Check if we successfully connected with the db
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('Successfully conected to MongoDB: ' + config.database);
});

app.set('superSecret', config.secret); // Secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// Use morgan to log requests to the console
app.use(morgan('dev')); // You can also use 'combined', 'common', 'short', 'tiny'

// Initialise the passport package
app.use(passport.initialize());

// pass passport for configuration
require('./config/passport')(passport); // get error when trying to import passport strategy from configuration file


// Serve the index file to allow users to login and upload interventions and get usage data
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

// Make the favicon available to the client
app.get('/client/img/icon.png', function (req, res) {
    res.sendFile(path.join(__dirname + '/client/img/icon.png'));
});

//Log the client IP on every request
app.use(function (req, res, next) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('Client IP:', ip);
    next();
});

// =======================
// routes ================
// =======================
// basic route
app.get('/', function (req, res) {
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

// Basic route used for testing only
app.get('/resources/sample4Model', function (req, res) {
    res.jsonp(sample4Model);
});

// Basic route used for testing only
app.get('/resources/sample5Model', function (req, res) {
    res.jsonp(sample5Model);
});

// Basic route used for testing only
app.get('/resources/sample6Model', function (req, res) {
    res.jsonp(sample6Model);
});

// Basic route used for testing only
app.get('/resources/sample7Model', function (req, res) {
    res.jsonp(sample7Model);
});

// Basic route used for testing only
app.get('/resources/sample8Model', function (req, res) {
    res.jsonp(sample8Model);
});

// Basic route used for testing only
app.get('/resources/sample9Model', function (req, res) {
    res.jsonp(sample9Model);
});

// Basic route used for testing only
app.get('/resources/sample10Model', function (req, res) {
    res.jsonp(sample10Model);
});

app.get('/resources/sample11Model', function (req, res) {
    res.jsonp(sample11Model);
});

app.get('/resources/sample12Model', function (req, res) {
    res.jsonp(sample12Model);
});

app.get('/resources/healthyMind', function (req, res) {
    res.jsonp(healthyMind);
});

// Set up a JWT RESTfull (Representational State Transfer) API strategy for user authentication
// API ROUTES -------------------
// get an instance of the router for api routes
var apiRoutes = express.Router();

// Route to authenticate a user (accessed at POST http://localhost:8080/api/authenticate)
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
                    var interventionID = user.interventionID;

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

                    */

                    // return the information including token as JSON
                    res.json({
                        success: true,
                        token: 'JWT ' + token,
                        interventionID: interventionID
                    });

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


// Route to store user feedback informations (accessed at POST http://localhost:8080/api/store)
apiRoutes.post('/store', function (req, res) {
    if (!req.body.key || !req.body.data) {
        res.json({
            success: false,
            msg: 'Please pass some information.'
        });
    } else {
        var newDataEntry = new DataEntry({
            key: req.body.key,
            data: req.body.data
        });
        // save the user
        newDataEntry.save(function (err) {
            if (err) {
                return res.json({
                    success: false,
                    msg: 'Data entry already exists.'
                });
            }
            res.json({
                success: true,
                msg: 'Successful stored new data entry.'
            });
        });
    }
});

// Route to create a new intervention entry on the database (accessed at POST http://localhost:8080/api/saveintervention)
apiRoutes.post('/saveintervention', function (req, res) {
    if (!req.body.key || !req.body.data) {
        res.json({
            success: false,
            msg: 'Please pass intervention key and value.'
        });
    } else {
        var newIntervention = new Intervention({
            key: req.body.key,
            data: req.body.data
        });
        // save the user
        newIntervention.save(function (err) {
            if (err) {
                return res.json({
                    success: false,
                    msg: 'Intervention name already exists, please use a different name for your intervention.'
                });
            }
            res.json({
                success: true,
                msg: 'Successfully stored your intervention in the database.'
            });
        });
    }
});


// Route to create a new user account (POST http://localhost:8080/api/signup)
apiRoutes.post('/signup', function (req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({
            success: false,
            msg: 'Please pass username and password.'
        });
    } else {
        var newUser = new User({
            name: req.body.name,
            surname: req.body.surname,
            username: req.body.username,
            password: req.body.password,
            interventionID: req.body.interventionID,
            email: req.body.email,
            tel: req.body.tel,
            location: req.body.location
        });
        // save the user
        newUser.save(function (err) {
            if (err) {
                return res.json({
                    success: false,
                    msg: 'Username already exists.'
                });
            }
            res.json({
                success: true,
                msg: 'Successful created new user.'
            });
        });
    }
});

// Protected route using JWT to a restricted dashboard page with all the interventions (GET http://localhost:8080/api/dashboard)
apiRoutes.get('/dashboard', passport.authenticate('jwt', {
    session: false
}), function (req, res) {
    var token = getToken(req.headers);
    if (token) {
        var decoded = jwt.decode(token, config.secret);
        User.findOne({
            name: decoded.name
        }, function (err, user) {
            if (err) throw err;

            if (!user) {
                return res.status(403).send({
                    success: false,
                    msg: 'Authentication failed. User not found.'
                });
            } else {
                //nest a method to get all inteventions and send them to the user
                res.json({
                    success: true,
                    msg: 'Welcome in the dashboard area ' + user.name + '!'
                });
            }
        });
    } else {
        return res.status(403).send({
            success: false,
            msg: 'No token provided.'
        });
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

// TODO: One of the option is to implement a route middleware to verify a token and will not allow
// for access to other routes unless a user is authenticated, please note that the order of the routes
// determines what can be accessed with and without authentication

// route to show a random message (GET http://localhost:8080/api/)
apiRoutes.get('/', function (req, res) {
    res.json({
        message: 'Welcome to the coolest API on earth!'
    });
});

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function (req, res) {
    User.find({}, function (err, users) {
        res.json(users);
    });
});

// route to return all interventions on the database (GET http://localhost:8080/api/interventions)
apiRoutes.get('/interventions', function (req, res) {
    Intervention.find({}, function (err, interventions) {
        res.json(interventions);
    });
});

// CRUD Routes  (GET http://localhost:8080/api/intervention)
apiRoutes.route('/intervention/:intervention_id')

// Get the intervention with this id (accessed at GET http://localhost:8080/api/intervention/:intervention_id)
.get(function (req, res) {
    Intervention.find({
        key: req.params.intervention_id
    }, function (err, intervention) {
        if (err)
            res.send(err);
        res.json(intervention);
    });
})

// Update the intervention with this id (accessed at PUT http://localhost:8080/api/intervention/:intervention_id)
.put(function (req, res) {

    // use the intervention model to find the intervention we want
    Intervention.findById(req.params.intervention_id, function (err, intervention) {

        if (err)
            res.send(err);

        intervention.name = req.body.name; // update the intervention name

        // save the intervention
        intervention.save(function (err) {
            if (err)
                res.send(err);

            res.json({
                message: 'Intervention updated!'
            });
        });

    });
})

// Delete the intervention with this id (accessed at DELETE http://localhost:8080/api/intervention/:intervention_id)
.delete(function (req, res) {
    Intervention.remove({
        key: req.params.intervention_id
    }, function (err, intervention) {
        if (err)
            res.send(err);

        res.json({
            message: 'Intervention successfully deleted'
        });
    });
});

// route to return an intervention (GET http://localhost:8080/api/getintervention)
apiRoutes.post('/getintervention', function (req, res) {
    if (!req.body.key) {
        res.json({
            success: false,
            msg: 'Please pass an intervention ID.'
        });
    } else {
        Intervention.find({
            key: req.body.key
        }, function (err, intervention) {
            res.json(intervention);
        });
    }
});

// route to return all stored date (GET http://localhost:8080/api/storedData)
apiRoutes.get('/storedData', function (req, res) {
    DataEntry.find({}, function (err, data) {
        res.json(data);
    });
});

// Apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

// =======================
// start the http and https servers ======
// =======================
var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(port);
httpsServer.listen(httpsport);

console.log('The http server is running at http://localhost:' + port);
console.log('The https server is running at https://localhost:' + httpsport);
