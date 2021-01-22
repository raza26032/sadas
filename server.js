var SERVER_SECRET = process.env.SECRET || "1234";

const PORT = process.env.PORT || 5000;

var express = require("express");
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var cors = require("cors");
var morgan = require("morgan");
var path = require("path")
var jwt = require('jsonwebtoken')
var { userModel, tweetsModel } = require('./dbconn/modules');
var app = express();
var authRoutes = require('./routes/auth')
var http = require("http");
var socketIO = require("socket.io");
var server = http.createServer(app);
var io = socketIO(server);
const fs = require('fs')
const multer = require('multer')
const admin = require("firebase-admin");

io.on("connection", () => {
    console.log("io is started");
})

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        cb(null, `${new Date().getTime()}-${file.filename}.${file.mimetype.split("/")[1]}`)
    }
})
var upload = multer({ storage: storage })

var serviceAccount = require("./firebase/firebase.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://login-bucket.firebaseio.com"
});

const bucket = admin.storage().bucket("gs://login-bucket.appspot.com");

app.use(bodyParser.json());
app.use(cookieParser());

app.use(cors({
    origin: '*',
    credentials: true
}));

app.use(morgan('dev'));
app.use("/", express.static(path.resolve(path.join(__dirname, "public"))))

app.use('/', authRoutes);
app.use(function (req, res, next) {
    if (!req.cookies.jToken) {
        res.status(401).send("include http-only credentials with every request")
        return;
    }
    jwt.verify(req.cookies.jToken, SERVER_SECRET, function (err, decodedData) {
        if (!err) {

            const issueDate = decodedData.iat * 1000;
            const nowDate = new Date().getTime();
            const diff = nowDate - issueDate;

            if (diff > 300000) {
                res.status(401).send("token expired")
            } else {
                var token = jwt.sign({
                    id: decodedData.id,
                    name: decodedData.name,
                    email: decodedData.email,
                }, SERVER_SECRET)
                res.cookie('jToken', token, {
                    maxAge: 86400000,
                    httpOnly: true
                });
                req.body.jToken = decodedData
                next();
            }
        } else {
            res.status(401).send("invalid token")
        }
    });
})

app.get("/profile", (req, res, next) => {
    userModel.findById(req.body.jToken.id, 'name email profilePic',
        function (err, doc) {
            if (!err) {
                res.send({
                    profile: doc
                })
            } else {
                res.status(500).send({
                    message: "server error"
                })
            }

        })
});

app.post("/postTweet", (req, res, next) => {
    if (!req.body.email || !req.body.tweetText) {
        res.status(409).send(`
            Please send email and tweet in json body
            e.g:
            "userEmail" : "abc@gmail.com",
            "tweetText" : "xxxxxx"
        `)
        return;
    };
    userModel.findById(req.body.jToken.id, 'name email profileUrl',
        (err, user) => {
            if (!err) {
                tweetsModel.create({
                    email: req.body.email,
                    tweetText: req.body.tweetText,
                    name: user.name,
                    profileUrl : user.profileUrl,
                }).then((data) => {
                    console.log("Tweet created: " + data),
                        res.status(200).send({
                            message: "tweet created",
                            name: user.name,
                            email: user.email,
                            profileUrl : user.profileUrl,
                        });
                    io.emit("NEW_POST", data);
                }).catch((err) => {
                    res.status(500).send({
                        message: "an error occured : " + err,
                    });
                });
            }
            else {
                res.status.send({
                    message: "an error occured" + err,
                })
            }
        })
});

app.get("/getTweets", (req, res, next) => {

    tweetsModel.find({}, (err, data) => {
        if (!err) {
            userModel.findById(req.body.jToken.id,  (err, user) => {
                console.log("tweet data=>", data);
                res.status(200).send({
                    tweets: data,
                });
            })
        }
        else {
            console.log("error : ", err);
            res.status(500).send("error");
        }
    })
});

app.get("/myTweets", (req, res, next) => {
    console.log("my tweets user=>", req.body);
    tweetsModel.find({ email: req.body.jToken.email }, (err, data) => {
        if (!err) {
            console.log("tweet data=>", data);
            res.status(200).send({
                tweets: data,
            });
        }
        else {
            console.log("error : ", err);
            res.status(500).send("error");
        }
    })
});

app.post("/upload", upload.any(), (req, res, next) => {
    userDetails = JSON.parse(req.body.myDetails)
    email = userDetails.email
    console.log("user email is => " , email);
    bucket.upload(
        req.files[0].path,
        function (err, file, apiResponse) {
            if (!err) {

                file.getSignedUrl({
                    action: 'read',
                    expires: '03-09-2491'
                }).then((urlData, err) => {
                    if (!err) {
                        console.log("public downloadable url: ", urlData[0]) 
                        console.log("my email is => ", email);
                        userModel.findOne({ email: email }, {}, (err, user) => {
                            if (!err) {
                                console.log("user is ===>", user);
                                user.update({ profilePic: urlData[0] }, (err, updatedUrl) => {
                                    if (!err) {
                                        res.status(200).send({
                                            message: "profile picture succesfully uploaded",
                                            url: urlData[0],
                                        })
                                        console.log("succesfully uploaded");
                                    }
                                    else {
                                        res.status(500).send({
                                            message: "an error occured" + err,
                                        })
                                        console.log("error occured whhile uploading");
                                    }

                                })
                            }
                        })

                        try {
                            fs.unlinkSync(req.files[0].path)
                            return;
                        } catch (err) {
                            console.error(err)
                        }
                    }
                })
            } else {
                console.log("err: ", err)
                res.status(500).send();
            }
        });
})


server.listen(PORT, () => {
    console.log("server is running on: ", PORT);
})