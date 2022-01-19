var express = require('express');
var {compileTrust} = require("express/lib/utils");
var path = require("path");
var multer = require('multer');
var fs = require("fs");
var router = express.Router();
var sqlite3 = require('sqlite3').verbose();
var db_name = path.join(__dirname, "db", "book.db");

const upload = multer({
  dest: 'images',
});

/* GET home page. */
router.get('/', function(req, res) {
  var books = [];
  var db = new sqlite3.Database(db_name);
  var sql = 'SELECT * FROM book';
  db.each(sql, [], (err, row) => {
    if (err) {
      res.render('index', {message: {status: 'error', content: 'There was an error during database query!'}});
      return;
    }
    books.push({
      name: row.name,
      isbn: row.isbn,
      author: row.author,
      publisher: row.publisher,
      release_date: row.release_date,
      cover: row.cover
    });
  }, function () {
    db.close();
    res.render('index', {books: books});
  });
});

router.get('/add', function(req, res) {
  res.render('add-book', {});
});

router.post('/add', upload.single('cover'), function(req, res) {
  var name = req.body.name;
  var isbn = req.body.isbn;
  var author = req.body.author;
  var publisher = req.body.publisher;
  var release_date = req.body.release_date;

  if (!name || !isbn || !author || !publisher || !release_date || !req.file) {
    res.render('add-book', {form: {name: name, isbn: isbn, author: author, publisher: publisher, release_date: release_date}, message: {status: 'error', content: 'All of fields are required!'}});
    return;
  }

  var db = new sqlite3.Database(db_name);
  var sql = 'SELECT COUNT(1) as result FROM book WHERE isbn = ?';
  db.get(sql, [isbn], (err, row) => {
    if (err) {
      res.render('add-book', {form: {name: name, isbn: isbn, author: author, publisher: publisher, release_date: release_date}, message: {status: 'error', content: 'There was an error during database query!'}});
      return;
    }
    var exist = row.result;
    if (exist) {
      res.render('add-book', {form: {name: name, isbn: isbn, author: author, publisher: publisher, release_date: release_date}, message: {status: 'error', content: 'Book of given ISBN already exist in database!'}});
    } else {
      var tempPath = req.file.path;
      var extension = path.extname(req.file.originalname).toLowerCase();
      var cover = isbn.concat(extension);
      var targetPath = path.join(__dirname, "../public/images/uploads", isbn.concat(extension));
      console.log(targetPath);

      if (extension == ".png" || extension == ".jpg" || extension == ".jpeg") {
        fs.rename(tempPath, targetPath, err => {
          if (err) {
            res.render('add-book', {
              form: {
                name: name,
                isbn: isbn,
                author: author,
                publisher: publisher,
                release_date: release_date
              }, message: {status: 'error', content: 'There was an error!'}
            });
            return;
          }

          db.run('INSERT INTO book(isbn, name, author, publisher, release_date, cover) VALUES (?, ?, ?, ?, ?, ?)', [isbn, name, author, publisher, release_date, cover], (err) => {
            if (err) {
              res.render('add-book', {
                form: {
                  name: name,
                  isbn: isbn,
                  author: author,
                  publisher: publisher,
                  release_date: release_date
                }, message: {status: 'error', content: 'There was an error while inserting data to the db!'}
              });
              return;
            }

            res.render('add-book', {message: {status: 'success', content: 'Book successfully added to database'}});
          });
        });
      } else {
        fs.unlink(tempPath, err => {
          if (err) {
            res.render('add-book', {
              form: {
                name: name,
                isbn: isbn,
                author: author,
                publisher: publisher,
                release_date: release_date
              }, message: {status: 'error', content: 'There was an error!'}
            });
            return;
          }

          res.render('add-book', {
            form: {
              name: name,
              isbn: isbn,
              author: author,
              publisher: publisher,
              release_date: release_date
            }, message: {status: 'error', content: 'Only .png, .jpg, .jpeg files are allowed!'}
          });
        });
      }
    }
  });
});

module.exports = router;
