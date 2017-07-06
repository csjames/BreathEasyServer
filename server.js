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
// Import the packages needed
// =======================
var express = require('express'); // A web application framework with features for web and mobile apps
var app = express();
var bodyParser = require('body-parser'); // A body parser for node.js
var morgan = require('morgan'); // Morgan is an HTTP request logger for node.js
var mongoose = require('mongoose');
var passport = require('passport');
var nodemailer = require('nodemailer');
var async = require('async');
var jwt = require('jwt-simple'); // used to create, sign, and verify tokens
var fs = require('fs');
var http = require('http');
var path = require('path'); // A library to serve the index and view files
var bcrypt = require('bcryptjs');
var crypto = require('crypto');
//var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
//var https = require('https');

// Data models and configuration files
var config = require('./config/database');
// Get the mongoose models
var User = require('./app/models/user');
var DataEntry = require('./app/models/data');
var UsageEntry = require('./app/models/usage');
var Location = require('./app/models/location');
var Intervention = require('./app/models/intervention');
//var privateKey = fs.readFileSync('sslcert/key.pem', 'utf8');
//var certificate = fs.readFileSync('sslcert/server.crt', 'utf8');


// Load local JSON intervention for testing purposes ***** NOT using authentication services
//var jsonModel = JSON.parse(fs.readFileSync('resources/lgtbdemo.json', 'utf8'));

// =======================
// configuration =========
// =======================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
// https port
//var httpsport = 8443;
console.log(config.database);
mongoose.connect(config.database); // connect to database

/*
// Load https authentication credentials
var credentials = {
    key: privateKey,
    cert: certificate
};
*/

// Check if we successfully connected with the db
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('Successfully conected to MongoDB: ' + config.database);
});

app.set('superSecret', config.secret); // Secret variable

// set jade templating folder and specify the jade templating engine to reset passwords
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

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

// Manually create a new admin account
function createAdmin() {
    var newUser = new User({
        username: "supremebeing",
        password: "theFifthElement97",
        role: {
            admin: true
        }
    });
    // save the user
    newUser.save(function (err) {
        if (err) {
            console.info("failed to create admin user " + err);
        } else {
            console.info("admin created successfully");
        }
    });
}

function createAuthor() {
    var newUser = new User({
        username: "LGAuthorAccount",
        password: "qPl29aveYn88",
        role: {
            admin: true
        }
    });
    // save the user
    newUser.save(function (err) {
        if (err) {
            console.info("failed to create author user " + err);
        } else {
            console.info("author created successfully");
        }
    });
}

// Create an admin and author account so that we can access the server
createAdmin();
createAuthor();

// =======================
// routes ================
// =======================

// Basic route, use for testing only
/*
app.get('/resources/Jmodel', function (req, res) {
    res.jsonp(jsonModel);
});
*/

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
                    var userRole = user.role;

                    // This code below is using the 'jsonwebtoken' jwt library this server is using 'jwt-simple'
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
                        interventionID: interventionID,
                        role: userRole
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
            role: {
                admin: req.body.role.admin,
                user: req.body.role.user,
                author: req.body.role.author
            },
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

// route for password reset
/*
apiRoutes.get('/forgot', function (req, res) {
    res.json({
        'user': req.user
    });
});
*/

// route for password reset
apiRoutes.post('/forgot', function (req, res, next) {
    async.waterfall([
    function (done) {
            crypto.randomBytes(20, function (err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
    },
    function (token, done) {
            User.findOne({
                username: req.body.username
            }, function (err, user) {
                if (!user) {
                    //req.flash('error', 'No account with that email address exists.');
                    console.log('No account with that email address exists: ' + req.body.username);
                    //return res.redirect(200, '#forgotPassword');
                    return res.json({'msg': req.body.username + ' user account does not exist'})
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // The reset password token is valid for 1 hour

                user.save(function (err) {
                    done(err, token, user);
                });
            });
    },
    function (token, user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'lifeguideuser@gmail.com',
                    pass: 'lifeguide'
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'lifeguideuser@gmail.com',
                subject: 'Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/api/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                //req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });

            /*
            res.json({
                'msg': 'Message sent to your email'
            });
            */

    }
  ], function (err) {
        if (err) return next(err);
        res.redirect('/#forgotPassword');
    });
});

apiRoutes.get('/reset/:token', function (req, res) {
    User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    }, function (err, user) {
        if (!user) {
            //req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/#forgotPassword');
        }

        //res.redirect('/#resetPassword');
        res.render('reset', {
            user: req.user
        });
    });
});

apiRoutes.post('/reset/:token', function (req, res) {
    async.waterfall([
    function (done) {
            User.findOne({
                resetPasswordToken: req.params.token,
                resetPasswordExpires: {
                    $gt: Date.now()
                }
            }, function (err, user) {
                if (!user) {
                    //req.flash('error', 'Password reset token is invalid or has expired.');
                    return res.redirect('back');
                }

                user.password = req.body.password;
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                user.save(function (err) {
                    req.logIn(user, function (err) {
                        done(err, user);
                    });
                });
            });
    },
    function (user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'lifeguideuser@gmail.com',
                    pass: 'lifeguide'
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'lifeguideuser@gmail.com',
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                //req.flash('success', 'Success! Your password has been changed.');
                done(err);
            });
    }
  ], function (err) {
        res.redirect('/');
    });
});


// Middleware route to verify a token that will not allow access access to following (routes declared after the middleware route)
// routes unless a user token is authenticated, please note that the order of the routes
// determines what can be accessed with and without user authentication
apiRoutes.use(function (req, res, next) {

    // check header or url parameters or post parameters for token
    //var token = req.body.token || req.query.token || req.headers['authorization'];
    var token = getToken(req.headers);

    // decode token
    if (token) {
        var decoded = jwt.decode(token, config.secret);

        if (decoded) {
            var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            console.log('Request from username: ' + decoded.username + ' from IP: ' + ip + ' success');
            next();
        } else {
            return res.status(403).send({
                success: false,
                message: 'Not able to verify token provided.'
            });
        }

        // passport authenticate does not work
        /*
        passport.authenticate('jwt', {
                session: false
            }),
            function (req, res) {
                console.log('Verified, you can now use the route you requsted');
                //var decoded = jwt.decode(token, config.secret);
                //req.decoded = decoded;

            }
        */

        // verifies secret and checks exp
        /*
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({
                    success: false,
                    message: 'Failed to authenticate token.'
                });
            } else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });
        */

    } else {
        // if there is no token return error
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        });
    }
});

apiRoutes.post('/location', function (req, res){
    if(!req.body.latitude && !req.body.longtitude){
        res.json({
            success: false,
            msg: 'Please pass some location data.'
        });
    } else {
        var token = getToken(req.headers);

        if (token) {
            var decoded = jwt.decode(token, config.secret);

            var newLocation = new Location ({
                user: decoded.username,
                timestamp: req.body.appTimestamp,
                latitude: req.body.latitude,
                longtitude: req.body.longtitude
            });

            newLocation.save(function (err) {
                if (err) {
                    return res.json({
                        success: false,
                        msg: 'Location data entry error.'
                    });
                }
                res.json({
                    success: true,
                    msg: 'Succesfully stored new location entry.'
                });
            });
        }
    }

});

// Route to store user usage data (accessed at POST http://localhost:8080/api/usage)
apiRoutes.post('/usage', function (req, res) {
    if (!req.body.activityID) {
        res.json({
            success: false,
            msg: 'Please pass some usage data.'
        });
    } else {
        var token = getToken(req.headers);

        if (token) {
            var decoded = jwt.decode(token, config.secret);
            if (decoded) {

                var newUsageEntry = new UsageEntry({
                    user: decoded.username,
                    activityID: req.body.activityID,
                    timestamp: req.body.appTimestamp
                });

                // save the usage data
                newUsageEntry.save(function (err) {
                    if (err) {
                        return res.json({
                            success: false,
                            msg: 'Usage Data entry error.'
                        });
                    }
                    res.json({
                        success: true,
                        msg: 'Successfully stored new usage data entry.'
                    });
                });
            }
        }
    }
});

// Route to store user response data (accessed at POST http://localhost:8080/api/store)
apiRoutes.post('/store', function (req, res) {
    if (!req.body.key || !req.body.data) {
        res.json({
            success: false,
            msg: 'Please pass some information.'
        });
    } else {
        var token = getToken(req.headers);

        if (token) {
            var decoded = jwt.decode(token, config.secret);
            if (decoded) {
                var newDataEntry = new DataEntry({
                    user: decoded.username,
                    intervention: decoded.interventionID,
                    key: req.body.key,
                    data: req.body.data
                });
                // save the user data
                newDataEntry.save(function (err) {
                    if (err) {
                        return res.json({
                            success: false,
                            msg: 'Data entry already exists.'
                        });
                    }
                    res.json({
                        success: true,
                        msg: 'Successfully stored your response.'
                    });
                });
            }
        }
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
            name: req.body.name,
            key: req.body.key,
            description: req.body.description,
            data: req.body.data
        });
        // save the new intervention
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

apiRoutes.get('/userss', passport.authenticate('jwt', {
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
                //nest a method to get all users
                var allusers = {};
                User.find({}, function (err, users) {
                    allusers = users;
                });
                res.json({
                    success: true,
                    msg: 'Request for all users by ' + user.name,
                    data: allusers
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

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function (req, res) {
    User.find({
        role: {
            user: true
        }
    }, function (err, users) {
        res.json(users);
    });
});

// route to return all interventions on the database (GET http://localhost:8080/api/interventions)
apiRoutes.get('/interventions', function (req, res) {
    Intervention.find({}, function (err, interventions) {
        res.json(interventions);
    });
});

// Function to take out any unusable metadat from user response, usage, and location data
function cleanUpData (inputData, model) {
    var columnHeading;
    var currentRow;
    var outputData = [];

    var column = {};
    var modelAttribute = {};

    console.info(inputData[0]);

    for (column in inputData[0]){
        columnHeading += column + ',';
    }
    console.info(columnHeading);

    outputData.push(columnHeading);

    var numberOfItems = inputData.length;

    for (var i = 0; numberOfItems > i; i++) {
        for (modelAttribute in model){
            currentRow += inputData[i].modelAttribute + ',';
        }
        console.info(currentRow);

        outputData.push(currentRow);
    }

    return outputData;
}

// route to return all users (GET http://localhost:8080/api/userUsageData)
apiRoutes.get('/userUsageData', function (req, res) {
    UsageEntry.find({}, function (err, usage) {
        res.json(usage);
    });
});

// route to return all stored data (GET http://localhost:8080/api/userResponseData)
apiRoutes.get('/userResponseData', function (req, res) {
    DataEntry.find({}, function (err, data) {
        res.json(data);
    });
});

// route to return all stored data (GET http://localhost:8080/api/userResponseData)
apiRoutes.get('/userLocationData', function (req, res) {
    Location.find({}, function (err, data) {
        //var locModel = {"_id":"", "user":"", "timestamp":"", "latitude":"", "longtitude":""}
        //var normalisedData = cleanUpData (data, locModel);
        res.json(data);
        //res.json(normalisedData);
    });
});

// CRUD Routes user (GET http://localhost:8080/api/user)
apiRoutes.route('/user/:username')

    // Get the user with this username (accessed at GET http://localhost:8080/api/user/:username)
    .get(function (req, res) {
        User.find({
            username: req.params.username
        }, function (err, user) {
            if (err)
                res.send(err);
            res.json(user);
        });
    })

    // Update the intervention with this id (accessed at PUT http://localhost:8080/api/intervention/:intervention_id)
    .put(function (req, res) {

        // use the intervention model to find the intervention we want
        User.findById(req.params.username, function (err, user) {

            if (err)
                res.send(err);

            user.name = req.body.name; // update the user name

            // save the user entry
            user.save(function (err) {
                if (err)
                    res.send(err);

                res.json({
                    message: 'user details updated!'
                });
            });

        });
    })

    // Delete the uesr with this id (accessed at DELETE http://localhost:8080/api/intervention/:user_id)
    .delete(function (req, res) {
        User.findOneAndRemove({
            username: req.params.username.slice(1)
        }, function (err, user) {
            if (err)
                res.send(err);

            res.json({
                message: 'User successfully deleted'
            });
        });
    });

// CRUD Routes for intervention (GET http://localhost:8080/api/intervention)
apiRoutes.route('/intervention/:intervention_id')

    // Get the intervention with this id (accessed at GET http://localhost:8080/api/intervention/:intervention_id)
    .get(function (req, res) {
        Intervention.findOne({
            key: req.params.intervention_id.slice(1)
        }, function (err, intervention) {
            if (err)
                res.send(err);
            res.json(intervention);
        });
    })

    // Update the intervention with this id (accessed at PUT http://localhost:8080/api/intervention/:intervention_id)
    .put(function (req, res) {

        console.log("The name of the intervention to update: " + req.params.intervention_id.slice(1));
        // use the intervention model to find the intervention we want
        Intervention.find({
            key: req.params.intervention_id.slice(1)
        }, function (err, intervention) {

            if (err)
                res.send(err);

            console.dir(req.body.content);

            intervention.data = req.body.content; // update the intervention data
            console.dir("The existing data: " + intervention.data);

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
        Intervention.findOneAndRemove({
            key: req.params.intervention_id.slice(1)
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

// Apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

// =======================
// start the http and https server ======
// =======================
var httpServer = http.createServer(app);
//var httpsServer = https.createServer(credentials, app);

httpServer.listen(port);
//httpsServer.listen(httpsport);

console.log('The http server is running at http://localhost:' + port);
//console.log('The https server is running at https://localhost:' + httpsport);
