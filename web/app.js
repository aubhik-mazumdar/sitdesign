var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var helpers = require('handlebars-helpers')();
var expressValidator = require('express-validator');
var flash = require('connect-flash');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var fs = require('fs');
var net = require('net');

process.on('uncaughtException', (err) => {
    console.log(err);
});

mongoose.connect('mongodb://mongo:27017/loginapp');
var db = mongoose.connection;

var routes = require('./routes/index');
var users = require('./routes/users');

// Init App
var app = express();
// default options

// View Engine
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs({
  defaultLayout: 'layout'
}));
app.set('view engine', 'handlebars');

// BodyParser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());

// Set Static Folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'files')));
app.use(express.static(path.join(__dirname, 'scripts')));
app.use(express.static(path.join(__dirname, 'scripts/jsc3d-full-1.6.5')));
app.use(express.static(path.join(__dirname, 'designs')));


// Express Session
app.use(session({
  secret: 'secret',
  saveUninitialized: true,
  resave: true
}));

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// Express Validator
app.use(expressValidator({
    errorFormatter: function (param, msg, value) {
	var namespace = param.split('.'),
	    root = namespace.shift(),
	    formParam = root;
	while (namespace.length) {
	    formParam += '[' + namespace.shift() + ']';
	}
	return {
	    param: formParam,
	    msg: msg,
	    value: value
	};
    }
}));

// Custom Validators
app.use(expressValidator({
    customValidators: {
	isSTEP: function (value, filename) {
	    let extension = (path.extname(filename)).toLowerCase();
	    if (!extension.match(/.stp|.step/)) {
		return false;
	    }
	    return true;
	}
    }
}));

// Connect Flash
app.use(flash());

// Global Vars
app.use(function (req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.user = req.user || null;
  next();
});


app.use('/', routes);
app.use('/users', users);

// Set Port
app.set('port', (3000));

app.listen(app.get('port'), function () {
  console.log('Server started on port ' + app.get('port'));
});

console.log("DIRNAME")
console.log(__dirname)

// Testing connection with python server
let HOST = process.env['COMPUTE_PORT_8080_TCP_ADDR'];
let PORT = Number(process.env['COMPUTE_PORT_8080_TCP_PORT']);
const client = net.createConnection({port: PORT, host:HOST}, () => {
    console.log('Connected to COMPUTE server');
    client.write(JSON.stringify({'command': 'TEST'}));
});
client.on('data', (data) => {
    console.log('Received: ', data);
    client.end();
});
client.on('end', () => {
    console.log('Disconnected from COMPUTE server');
});

module.exports;