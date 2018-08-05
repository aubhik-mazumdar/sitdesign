/** Imports */
var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var PythonShell = require('python-shell');
var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var fileUpload = require('express-fileupload');
var nodemailer = require('nodemailer');
var User = require('../models/user');
var config = require('./config');

/** Express Router object */
var router = express.Router();
router.use(fileUpload())

