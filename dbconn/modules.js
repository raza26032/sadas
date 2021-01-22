var mongoose = require("mongoose");

let dbURI = "mongodb+srv://raza26032:raza26032@cluster0.ypq3m.mongodb.net/firstDB?retryWrites=true&w=majority";
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });

////////////////mongodb connected disconnected events///////////////////////////////////////////////
mongoose.connection.on('connected', function () {//connected
    console.log("Mongoose is connected");
});

mongoose.connection.on('disconnected', function () {//disconnected
    console.log("Mongoose is disconnected");
    process.exit(1);
});

mongoose.connection.on('error', function (err) {//any error
    console.log('Mongoose connection error: ', err);
    process.exit(1);
});

process.on('SIGINT', function () {/////this function will run jst before app is closing
    console.log("app is terminating");
    mongoose.connection.close(function () {
        console.log('Mongoose default connection closed');
        process.exit(0);
    });
});
////////////////mongodb connected disconnected events///////////////////////////////////////////////

var userSchema = new mongoose.Schema({
    "name": String,
    "email": String,
    "password": String,
    "phone": String,
    "gender": String,
    "profilePic": String,
    "createdOn": { "type": Date, "default": Date.now },
    "activeSince": Date
});

var userModel = mongoose.model("users", userSchema);

var resetPassword = new mongoose.Schema({
    "email": String,
    "otp": String,
    "createdOn": { "type": Date, "default": Date.now },
});
var otpModel = mongoose.model("otp", resetPassword);

var tweetsSchema = mongoose.Schema({
    email : String,
    tweetText : String,
    name : String,
    profileUrl : String,
    "createdOn" : { "type": Date, "default": Date.now },
})

var tweetsModel = mongoose.model("tweets",tweetsSchema);

module.exports = {
    userModel: userModel,
    otpModel: otpModel,
    tweetsModel : tweetsModel,
}