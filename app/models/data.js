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


// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcryptjs');

var DataSchema = new Schema({
    user: String,
    intervention: String,
    key: {
        type: String,
        required: true
    },
    data: String
});

// on every save/update, add the date
DataSchema.pre('save', function (next) {
    // get the current date
    var currentDate = new Date();

    // change the updated_at field to current date
    this.updated_at = currentDate;

    // if created_at doesn't exist, add to that field
    if (!this.created_at)
        this.created_at = currentDate;

    next();
});

// Create a schema, it define the structure of documents within a collection
// Create a model using a schema, models are used to create instances of data that will be stored in documents
// Mongoose also creates a MongoDB collection called 'User' for these documents
// set up a mongoose model and pass it to our node applications using module.exports
module.exports = mongoose.model('DataEntry', DataSchema);
