const express = require('express');
const app = express();
const path = require('path');
const session = require('cookie-session');
var bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const formidable = require('express-formidable');
const url = 'mongodb://laichisin:vv12345@cluster0-shard-00-00.xjjvz.mongodb.net:27017,cluster0-shard-00-01.xjjvz.mongodb.net:27017,cluster0-shard-00-02.xjjvz.mongodb.net:27017/test?ssl=true&replicaSet=atlas-xtae8i-shard-0&authSource=admin&retryWrites=true&w=majority'
const fs = require("fs");
const multer = require('multer');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './tmp')
  },
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname)
    cb(null, file.fieldname + '-' + Date.now() + ext)
  }
})
const upload = multer({storage: storage})

app.use(session({
  name: '',
  keys: [' ']
}));
app.use(formidable());
app.use(express.static('tmp'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', function (req, res) {
  const owner = req.session.owner;
  if (owner === undefined) {
    res.redirect('/login');
  } else {    res.redirect('/read');
  }
});

app.get('/login', function (req, res) {
  res.render('login')
})

app.post('/login', function (req, res) {
  const {name, pwd} = req.body
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {name, pwd};  
    dbo.collection("restUser").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      if (result.length > 0) {
        req.session.owner = name
        console.log("logged in successfully ")
        res.redirect('/read');
      } else {
        console.log("wrong password")
        res.redirect('/login');
      }
      db.close();
    });
  });
})

app.get('/signin', function (req, res) {
  res.render('signin')
})

app.post('/signin', function (req, res) {
  const {name, pwd} = req.body
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {name};  
    dbo.collection("restUser").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      if (result.length === 0) {
        dbo.collection("restUser").insertOne({name, pwd}, function (err, result) {
          if (err) throw err;
          req.session.owner = name
          console.log("logged in successfully")
          res.redirect('/read');
        });
      } else {
        console.log("already exists")
        res.redirect('/login');
      }
      db.close();
    });
  });
})

app.get('/read', function (req, res) {
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      console.log("search successful")
      console.log(result)
      let params = []
      for (let x in result) {
        x = JSON.parse(JSON.stringify(result[x]))
        params.push({id: x["_id"], name: x["name"]})
      }
      res.render('read', {params})
      db.close();
    });
  });
})

app.get('/display', function (req, res) {
  const _id = req.query._id
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {_id: ObjectID(_id)};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      if (result.length === 0) {
        console.log("can't find this id")
        res.redirect('/read');
      } else {
        data = JSON.parse(JSON.stringify(result[0]))
        let photo = data.photo
        let _id = data._id
        let grades = data.grades
        delete data.photo
        delete data.mimetype
        delete data._id
        delete data.grades
        console.log("successfully abtained")
        res.render('display', {rest: data, photo, _id, grades});
      }
      db.close();
    });
  });
})

app.get('/new', function (req, res) {
  res.render('new')
})

app.post('/new', upload.single('photo'), function (req, res) {
  const {name, borough, cuisine, street, building, zipcode, coord} = req.body
  let photo = ''
  let mimetype = ''
  try {
    photo = req.file.filename
    mimetype = req.file.mimetype
  } catch (e) {
  }
  const owner = req.session.owner
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {name};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      if (result.length === 0) {
        dbo.collection("restRest").insertOne({
          name,
          borough,
          cuisine,
          photo,
          mimetype,
          street,
          building,
          zipcode,
          coord,
          owner
        }, function (err, result) {
          if (err) throw err;
          console.log("created")
          res.redirect('/read');
        });
      } else {
        console.log("already exists")
        res.redirect('/new');
      }
      db.close();
    });
  });
})

app.get('/rate', function (req, res) {
  res.render('rate', {_id: req.query._id})
})

app.post('/rate', function (req, res) {
  const {rate, _id} = req.body
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {_id: ObjectID(_id)};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      if (result.length === 0) {
        console.log("this id no exist")
        res.redirect('/read');
      } else {
        if (result[0].grades !== undefined) {
          for (let i in result[0].grades) {
            if (result[0].grades[i].user === req.session.owner) {
              res.redirect('/display?_id=' + _id);
              console.log("this user has commented")
              db.close();
              return
            }
          }
        } 
        var updateStr = {$push: {grades: {score: rate, user: req.session.owner}}};
        dbo.collection("restRest").updateOne(whereStr, updateStr, function (err, result) {
          if (err) throw err;
          console.log("successful comment")
          res.redirect('/display?_id=' + _id);
        });
      }
      db.close();
    });
  });
})

app.get('/change', function (req, res) {
  res.render('change', {_id: req.query._id, name: req.query.name})
})

app.post('/change', upload.single('photo'), function (req, res) {
  const {_id, borough, cuisine, street, building, zipcode, coord} = req.body
  let photo = ''
  let mimetype = ''
  try {
    photo = req.file.filename
    mimetype = req.file.mimetype
  } catch (e) {
  }
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("rerestaurantst");
    var whereStr = {_id: ObjectID(_id)};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      if (result.length === 0) {
        console.log("this id no exist")
        res.redirect('/read');
      } else {
        if (result[0].owner === req.session.owner) { 
          var updateStr = {$set: {borough, cuisine, street, building, zipcode, coord, photo, mimetype}};
          dbo.collection("restRest").updateOne(whereStr, updateStr, function (err, result) {
            if (err) throw err;
            console.log("successfully modified")
            res.redirect('/display?_id=' + _id);
          });
        } else {
          console.log("not owner")
          res.redirect('/display?_id=' + _id);
        }
      }
      db.close();
    });
  });
})

app.get('/remove', function (req, res) {
  const {_id} = req.query
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {_id: ObjectID(_id)};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      if (result.length === 0) {
        console.log("this id no exist")
        res.redirect('/read');
      } else {
        if (result[0].owner === req.session.owner) { 
          dbo.collection("restRest").deleteOne(whereStr, function (err, result) {
            if (err) throw err;
            console.log("successfully deleted")
            res.redirect('/read');
          });
        } else {
          console.log("not owner")
          res.redirect('/display?_id=' + _id);
        }
      }
      db.close();
    });
  });
})

app.get('/api/restaurant/name/:name',function(req, res){
  const name = req.params.name
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("rest");
    var whereStr = {name};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      res.send(JSON.stringify(result))
      db.close();
    });
  });
})

app.get('/api/restaurant/borough/:borough',function(req, res){
  const borough = req.params.borough
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {borough};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      res.send(JSON.stringify(result))
      db.close();
    });
  });
})

app.get('/api/restaurant/cuisine/:cuisine',function(req, res){
  const cuisine = req.params.cuisine
  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("restaurant");
    var whereStr = {cuisine};  
    dbo.collection("restRest").find(whereStr).toArray(function (err, result) {
      if (err) throw err;
      res.send(JSON.stringify(result))
      db.close();
    });
  });
})

module.exports = app
