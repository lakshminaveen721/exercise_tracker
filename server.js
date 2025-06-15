const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./exercise.db');

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL)");
  db.run("CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, description TEXT, duration INTEGER, date TEXT)");
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.post('/api/users', (req, res) => {
  const username = req.body.username;
  db.run("INSERT INTO users (username) VALUES (?)", [username], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ username: String(username), _id: String(this.lastID) });
  });
});

app.get('/api/users', (req, res) => {
  db.all("SELECT username, id AS _id FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(user => ({
      username: String(user.username),
      _id: String(user._id)
    })));
  });
});

app.post('/api/users/:_id/exercises', (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;
  const entryDate = date ? new Date(date) : new Date();
  const dateString = entryDate.toDateString();

  db.get("SELECT username FROM users WHERE id = ?", [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });

    db.run(
      "INSERT INTO exercises (user_id, description, duration, date) VALUES (?, ?, ?, ?)",
      [userId, description, parseInt(duration), dateString],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.send({
          username: String(user.username),
          description: String(description),
          duration: parseInt(duration),
          date: String(dateString),
          _id: String(userId)
        });
      }
    );
  });
});

app.get('/api/users/:_id/logs', (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  db.get("SELECT username FROM users WHERE id = ?", [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });

    let query = "SELECT description, duration, date FROM exercises WHERE user_id = ?";
    const params = [userId];

    if (from) {
      query += " AND date >= ?";
      params.push(new Date(from).toDateString());
    }

    if (to) {
      query += " AND date <= ?";
      params.push(new Date(to).toDateString());
    }

    query += " ORDER BY date ASC";
    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit));
    }

    db.all(query, params, (err, exercises) => {
      if (err) return res.status(500).json({ error: err.message });
      res.send({
        username: String(user.username),
        count: exercises.length,
        _id: String(userId),
        log: exercises.map(e => ({
          description: String(e.description),
          duration: parseInt(e.duration),
          date: String(e.date)
        }))
      });
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
