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

router.get('/', function(req, res) {
  var message;
  var books = [];
  var db = new sqlite3.Database(db_name);
  var sql = 'SELECT * FROM book';

  var content = req.query.content;
  var status = req.query.status;
  if (content != null && status != null) {
      message = {status: status, content: content};
  }

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
    res.render('index', {books: books, message: message});
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

router.get('/delete/:isbn', function (req, res) {
  var _isbn = req.params.isbn;
  var db = new sqlite3.Database(db_name);

  var sql = 'SELECT cover FROM book WHERE isbn = ?';
  db.get(sql, _isbn, (err, row) => {
    if (err) {
      res.redirect('/?content=There was an error during database query&status=error');
      return;
    }

    if (row && row.cover) {
      var coverName = row.cover;
      var targetPath = path.join(__dirname, "../public/images/uploads", coverName);

      db.run('DELETE FROM book WHERE isbn=?', _isbn, function (err) {
        if (err) {
          res.redirect('/?content=There was an error during database query&status=error');
          return;
        }

        fs.unlink(targetPath, err => {
          if (err) {
            res.redirect('/?content=There was an error during image delete&status=error');
            return;
          }

          res.redirect('/?content=Book successfully removed from database&status=success');
        });
      });
    } else {
      res.redirect('/?content=Book of given ISBN does not exist!&status=error');
    }
  });

  db.close();
});

router.get('/edit/:isbn', function(req, res) {
  var _isbn = req.params.isbn;
  var db = new sqlite3.Database(db_name);

  var sql = 'SELECT * FROM book WHERE isbn = ?';
  db.get(sql, _isbn, (err, row) => {
    if (err) {
      res.redirect('/?content=There was an error during database query&status=error');
      return;
    }

    if (row) {
      res.render('edit-book', {form: row, isbn: _isbn});
    } else {
      res.redirect('/?content=Book of given ISBN does not exist!&status=error');
    }
  });
});

router.post('/edit/:isbn', function (req, res) {
  var _isbn = req.params.isbn;
  var name = req.body.name;
  var isbn = req.body.isbn;
  var author = req.body.author;
  var publisher = req.body.publisher;
  var release_date = req.body.release_date;

  if (!name || !isbn || !author || !publisher || !release_date) {
    res.render('edit-book', {isbn: _isbn, form: {name: name, isbn: isbn, author: author, publisher: publisher, release_date: release_date}, message: {status: 'error', content: 'All of fields are required!'}});
    return;
  }

  var db = new sqlite3.Database(db_name);
  var sql = 'SELECT COUNT(1) as result FROM book WHERE isbn = ?';
  db.get(sql, [isbn], (err, row) => {
    if (err) {
      res.render('edit-book', {
        isbn: _isbn,
        form: {
          name: name,
          isbn: isbn,
          author: author,
          publisher: publisher,
          release_date: release_date
        }, message: {status: 'error', content: 'There was an error during database query!'}
      });
      return;
    }
    var exist = row.result;
    if (exist && isbn != _isbn) {
      res.render('edit-book', {
        isbn: _isbn,
        form: {
          name: name,
          isbn: isbn,
          author: author,
          publisher: publisher,
          release_date: release_date
        }, message: {status: 'error', content: 'Book of given ISBN already exist in database!'}
      });
    } else {
      var sql = 'SELECT cover FROM book WHERE isbn = ?';
      db.get(sql, [_isbn], (err, row) => {
        if (err) {
          res.render('edit-book', {
            isbn: _isbn,
            form: {
              name: name,
              isbn: isbn,
              author: author,
              publisher: publisher,
              release_date: release_date
            }, message: {status: 'error', content: 'There was an error during database query!'}
          });
          return;
        }

        if (row) {
          var coverName = row.cover;
          var extension = path.extname(coverName)
          var newCoverName = isbn.concat(extension);

          var basePath = path.join(__dirname, "../public/images/uploads", coverName);
          var targetPath = path.join(__dirname, "../public/images/uploads", newCoverName);

          fs.rename(basePath, targetPath, err => {
            if (err) {
              res.render('edit-book', {
                isbn: _isbn,
                form: {
                  name: name,
                  isbn: isbn,
                  author: author,
                  publisher: publisher,
                  release_date: release_date
                }, message: {status: 'error', content: 'There was an error while copying files!'}
              });
              return;
            }

            db.run('UPDATE book SET isbn = ?, name = ?, author = ?, publisher = ?, release_date = ?, cover = ? WHERE isbn = ?', [isbn, name, author, publisher, release_date, newCoverName, _isbn], (err) => {
              if (err) {
                res.render('edit-book', {
                  isbn: _isbn,
                  form: {
                    name: name,
                    isbn: isbn,
                    author: author,
                    publisher: publisher,
                    release_date: release_date
                  }, message: {status: 'error', content: 'There was an error while editing data!'}
                });
                return;
              }
              res.render('edit-book', {
                isbn: isbn,
                form: {name: name, isbn: isbn, author: author, publisher: publisher, release_date: release_date},
                message: {status: 'success', content: 'Book successfully edited'}
              });
            });
          });
        } else {
          res.render('edit-book', {
            isbn: _isbn,
            form: {
              name: name,
              isbn: isbn,
              author: author,
              publisher: publisher,
              release_date: release_date
            }, message: {status: 'error', content: 'There was an error while editing data!'}
          });
        }
      });
    }
  });
});

module.exports = router;
