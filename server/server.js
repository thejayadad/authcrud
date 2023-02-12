require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const expressLayouts = require("express-ejs-layouts");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')

const app = express();


app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set("layout", "./layouts/main");

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));



app.use(passport.initialize());
app.use(passport.session());




const uri = process.env.ATLAS_URI;
mongoose.set('strictQuery', true);

mongoose.connect(uri, { useNewUrlParser: true }
);
const connection = mongoose.connection;
connection.once('open', () => {
  console.log("MongoDB Connected");
})


const userSchema = new mongoose.Schema ({
    email: String,
    username: String,
    password: String,
    googleId: String,
    secret: String
  });

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = new mongoose.model("User", userSchema);
passport.use(User.createStrategy());


passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/notes",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"

  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate( {googleId : profile.id, username: profile.displayName}, function( err, foundUser ){
        if( !err ){                                                          //Check for any errors
            if( foundUser ){                                          // Check for if we found any users
                return cb( null, foundUser );                  //Will return the foundUser
            }else {                                                        //Create a new User
                const newUser = new User({
                    googleId : profile.id,
                    username : profile.displayName
                });
                newUser.save( function( err ){
                    if(!err){
                        return cb(null, newUser);                //return newUser
                    }
                });
            }
        }else{
            console.log( err );
        }
    });

  }
));


//ROUTES
app.get("/", function(req, res){
    res.render("home");
  });
//CREATE A USER:

app.get("/register", function(req, res){
    res.render("register");
  });
app.post("/register", function(req, res){

    User.register({username: req.body.username, email: req.body.email}, req.body.password, function(err, user){
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/notes");
        });
      }
    });

  });



  //NOTES LOGIN PAGE


app.get("/login", function(req, res) {
    res.render("login");
})

  app.get("/notes", function(req, res) {
    if(req.isAuthenticated()){
        res.render("notes");
    } else {
        res.redirect("/login")
    }
  })

  app.post("/login", function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })
    req.login(user, function(err) {
        if(err){
            console.log(err)
        } else{
            passport.authenticate("local")(req, res, function() {
                res.redirect("/notes")
            })
        }
    })
  })

//LOGOUT ROUTE
app.get("/logout", function(req, res){
    req.session.user = null
  req.session.save(function (err) {
    if (err) next(err)


    req.session.regenerate(function (err) {
      if (err) next(err)
      res.redirect('/login')
    })
  })

  });

  //SIGNIN WITH GOOGLE

  app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/notes",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/notes");
  });

  //SUBMIT A NOTE

  app.get("/submit", function(req, res){
    if (req.isAuthenticated()){
      res.render("submit");
    } else {
      res.redirect("/login");
    }
  });

  app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;

  //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
    // console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.secret = submittedSecret;
          foundUser.save(function(){
            res.redirect("/notes");
          });
        }
      }
    });
  });

  app.post("/register", function(req, res){

    User.register({username: req.body.username}, req.body.password, function(err, user){
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/secrets");
        });
      }
    });

  });




  app.listen(3000, function() {
    console.log("Server started on port 3000.");
  });
