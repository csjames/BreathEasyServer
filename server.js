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
//var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var jwt = require('jwt-simple');
var config = require('./config/database');
var User = require('./app/models/user'); // get our mongoose model
var DataEntry = require('./app/models/data');
var Intervention = require('./app/models/intervention');
var fs = require('fs');
var http = require('http');
//var https = require('https');
//var privateKey = fs.readFileSync('sslcert/key.pem', 'utf8');
//var certificate = fs.readFileSync('sslcert/server.crt', 'utf8');
var path = require('path'); // A library to serve the index file

// Load local JSON intervention for testing purposes ***** NOT using authentication services
//var jsonModel = JSON.parse(fs.readFileSync('resources/lgtbdemo.json', 'utf8'));

// =======================
// configuration =========
// =======================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
// https port
//var httpsport = 8443;
mongoose.connect(config.database); // connect to database

/*
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

//Log the client IP on screen on every request
app.use(function (req, res, next) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('Client IP:', ip);
    next();
});



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
            console.log('Request from username: ' + decoded.username);
            next();
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




// Route to store user feedback informations (accessed at POST http://localhost:8080/api/store)
apiRoutes.post('/store', function (req, res) {
    if (!req.body.key || !req.body.data) {
        res.json({
            success: false,
            msg: 'Please pass some information.'
        });
    } else {
        var newDataEntry = new DataEntry({
            user: req.body.userid,
            intervention: req.body.interventionid,
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

// route for password reset
apiRoutes.get('/forgot', function (req, res) {
    res.render('forgot', {
        user: req.user
    });
});

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
                email: req.body.email
            }, function (err, user) {
                if (!user) {
                    req.flash('error', 'No account with that email address exists.');
                    return res.redirect('/forgot');
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function (err) {
                    done(err, token, user);
                });
            });
    },
    function (token, user, done) {
            var smtpTransport = nodemailer.createTransport('SMTP', {
                service: 'SendGrid',
                auth: {
                    user: '!!! YOUR SENDGRID USERNAME !!!',
                    pass: '!!! YOUR SENDGRID PASSWORD !!!'
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'passwordreset@demo.com',
                subject: 'Node.js Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });
    }
  ], function (err) {
        if (err) return next(err);
        res.redirect('/forgot');
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
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }
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
                    req.flash('error', 'Password reset token is invalid or has expired.');
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
            var smtpTransport = nodemailer.createTransport('SMTP', {
                service: 'SendGrid',
                auth: {
                    user: '!!! YOUR SENDGRID USERNAME !!!',
                    pass: '!!! YOUR SENDGRID PASSWORD !!!'
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'passwordreset@demo.com',
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                req.flash('success', 'Success! Your password has been changed.');
                done(err);
            });
    }
  ], function (err) {
        res.redirect('/');
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

// route to return all stored data (GET http://localhost:8080/api/storedData)
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
//var httpsServer = https.createServer(credentials, app);

httpServer.listen(port);
//httpsServer.listen(httpsport);

console.log('The http server is running at http://localhost:' + port);
//console.log('The https server is running at https://localhost:' + httpsport);
