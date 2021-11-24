// Express
const express = require('express');
const app = express();
const path = require('path');

// Middleware
const dotenv = require('dotenv');
const nunjucks = require('nunjucks');
const methodOverride = require('method-override');

// Database
const MongoClient = require('mongodb').MongoClient;

// Passport
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');

// Multer
let multer = require('multer');
var storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, './public/image');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
  fileFilter: function (req, file, callback) {
    const ext = path.extname(file.originalname);
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
      return callback(new Error('PNG, JPG만 업로드하세요'));
    }
    callback(null, true);
  }
});
var upload = multer({ storage: storage });

dotenv.config();
app.use(methodOverride('_method'));

app.set('view engine', 'html');
nunjucks.configure('views', {
  express: app,
  watch: true,
});

app.use(session({
  HttpOnly: true,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60
  }
}));

app.use(passport.initialize());
app.use(passport.session());

var db;
MongoClient.connect(process.env.DB_URL, (err, client) => {
  if (err) return console.log(err);
  db = client.db('UOSMarket');

  app.listen(process.env.PORT, () => {
    console.log('listening on 8080');
  });
});

app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static('public'));

passport.use(new LocalStrategy({
  usernameField: 'id',
  passwordField: 'pw',
  session: true,
  passReqToCallback: false,
}, (id, pw, done) => {
  db.collection('login').findOne({ id: id }, async (err, result) => {
    if (err) return done(err)

    if (!result) return done(null, false, { message: '아이디가 존재하지 않음' })
    try {
      const match = await bcrypt.compare(pw, result.pw);
      if (match) {
        return done(null, result)
      } else {
        return done(null, false, { message: '비밀번호가 틀림' })
      }
    } catch (error) {

    }
  });
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.collection('login').findOne({ id: id }, (err, result) => {
    done(null, result);
  })
});

app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', passport.authenticate('local', {
  failureRedirect: '/fail',
}), (req, res) => {
  res.redirect('/');
});

app.get('/list', (req, res) => {
  db.collection('post').find().toArray((err, result) => {
    res.render('list', { posts: result, user: req.user });
  })
});

app.get('/write', loginCheck, (req, res) => {
  res.render('write', { user: req.user });
});

// app.get('/likeView', loginCheck, (req, res) => {
//   res.render('likeView', { user: req.user });
// });

function loginCheck(req, res, next) {
  if (req.user) {
    next()
  }
  else {
    res.redirect('/login');
  }
}
app.get('/join', (req, res) => {
  res.render('join');
})
app.post('/join', (req, res) => {
  db.collection('login').findOne({ id: req.body.id }, async (err, result) => {
    if (result) {

    }
    try {
      if (!result) {
        console.log(req.body.pw);
        const hash = await bcrypt.hash(req.body.pw, 12);
        console.log(hash);
        db.collection('login').insertOne({ id: req.body.id, pw: hash }, (err, result) => {
          res.redirect('/');
        });
      } else {
        res.send('다른 아이디를 사용하여주시기 바랍니다.');
      }
    } catch (error) {
      console.log(error);
    }
  });
});

app.post('/write', (req, res) => {
  db.collection('counter').findOne({ name: '게시물갯수' }, (err, result) => {
    var totalPost = result.totalPost;
    db.collection('post').insertOne({ _id: totalPost + 1, title: req.body.title, money: req.body.money, description: req.body.description, kakaoid: req.body.kakao }, (err, result) => {
      res.redirect('/imgUpload');
      db.collection('counter').updateOne({ name: '게시물갯수' }, { $inc: { totalPost: 1 } });
    });
  });
});

app.get('/imgUpload', (req, res) => {
  res.render('imgUpload', { user: req.user });
});

app.post('/imgUpload', upload.single('img'), (req, res) => {
  res.redirect('/');
});

app.get('/search', (req, res) => {
  var searchIndex = [
    {
      $search: {
        index: 'uosTitleSearch',
        text: {
          query: req.query.value,
          path: 'title'
        }
      }
    }
  ]
  db.collection('post').aggregate(searchIndex).toArray((err, result) => {
    res.render('search', { posts: result });
  });
});

app.get('/detail/:id', (req, res) => {
  db.collection('post').findOne({ _id: parseInt(req.params.id) }, (err, result) => {
    res.render('detail', { data: result })
  });
});