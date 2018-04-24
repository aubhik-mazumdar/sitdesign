var express = require('express');
var User = require('../models/user');
var router = express.Router();

router.get('/', ensureAuthenticated, function (req, res) {
  var tempOrg = [], tempRem = [];
  User.findOne({
    'username': req.user.username
  }, function (err, user) {
    for (let i = 0; i < user.files.length; i++) {
      if(user.files[i].type=='Remixed')
        tempRem.push(user.files[i].path);
      else
        tempOrg.push(user.files[i].path);
    }
    res.render('homepage', {
      org: tempOrg,
      rem: tempRem
    });
  });
});


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    //req.flash('error_msg','You are not logged in');
    res.redirect('/users/login');
  }
}


module.exports = router;