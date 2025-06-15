const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db'); // Your SQLite database connection
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
require('dotenv').config();

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// --- API Routes ---

// 1. Create a new user
// POST /api/users with form data username
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.json({ error: 'Username is required' });
  }

  const _id = uuidv4(); // Generate a unique ID for the new user

  db.run('INSERT INTO users (_id, username) VALUES (?, ?)', [_id, username], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed: users.username')) {
        return res.json({ error: 'Username already exists' });
      }
      console.error('Error inserting user:', err.message);
      return res.json({ error: 'Error creating user' });
    }
    res.json({ username, _id });
  });
});

// 2. Get a list of all users
// GET /api/users
app.get('/api/users', (req, res) => {
  db.all('SELECT _id, username FROM users', [], (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      return res.json({ error: 'Error fetching users' });
    }
    res.json(rows);
  });
});

// 3. Add an exercise for a user
// POST /api/users/:_id/exercises with form data description, duration, and optionally date
app.post('/api/users/:_id/exercises', (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  if (!description || !duration) {
    return res.json({ error: 'Description and duration are required' });
  }

  const parsedDuration = parseInt(duration);
  if (isNaN(parsedDuration)) {
    return res.json({ error: 'Duration must be a number' });
  }

  const exerciseId = uuidv4();
  const exerciseDate = date ? new Date(date) : new Date();
  const formattedDate = exerciseDate.toDateString(); // "Mon Jan 01 1990" format

  // First, check if the user exists
  db.get('SELECT _id, username FROM users WHERE _id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error checking user existence:', err.message);
      return res.json({ error: 'Database error' });
    }
    if (!user) {
      return res.json({ error: 'User not found' });
    }

    // Insert the exercise
    db.run(
      'INSERT INTO exercises (_id, userId, description, duration, date) VALUES (?, ?, ?, ?, ?)',
      [exerciseId, userId, description, parsedDuration, formattedDate],
      function(err) {
        if (err) {
          console.error('Error inserting exercise:', err.message);
          return res.json({ error: 'Error adding exercise' });
        }
        res.json({
          _id: user._id,
          username: user.username,
          date: formattedDate,
          duration: parsedDuration,
          description: description
        });
      }
    );
  });
});

// 4. Retrieve a full exercise log for a user
// GET /api/users/:_id/logs with optional from, to, and limit parameters
app.get('/api/users/:_id/logs', (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  // Check if the user exists first
  db.get('SELECT _id, username FROM users WHERE _id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error checking user existence for logs:', err.message);
      return res.json({ error: 'Database error' });
    }
    if (!user) {
      return res.json({ error: 'User not found' });
    }

    let query = 'SELECT description, duration, date FROM exercises WHERE userId = ?';
    const params = [userId];

    // Build date range filter
    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate)) {
          return res.json({ error: "Invalid 'from' date format. Use yyyy-mm-dd." });
      }
      query += ' AND date >= ?';
      // SQLite date comparison works better with ISO strings or consistent date strings
      // We're storing toDateString, so comparing strings lexicographically here.
      // For more robust date range querying, consider storing dates as YYYY-MM-DD or timestamps.
      params.push(fromDate.toDateString()); 
    }
    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate)) {
          return res.json({ error: "Invalid 'to' date format. Use yyyy-mm-dd." });
      }
      query += ' AND date <= ?';
      params.push(toDate.toDateString());
    }

    // Add limit
    if (limit) {
      const parsedLimit = parseInt(limit);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        return res.json({ error: 'Limit must be a positive integer' });
      }
      query += ' LIMIT ?';
      params.push(parsedLimit);
    }

    db.all(query, params, (err, exercises) => {
      if (err) {
        console.error('Error fetching exercise log:', err.message);
        return res.json({ error: 'Error fetching exercise log' });
      }

      const log = exercises.map(ex => ({
        description: ex.description,
        duration: ex.duration,
        date: ex.date // Date is already in "Mon Jan 01 1990" format from storage
      }));

      res.json({
        _id: user._id,
        username: user.username,
        count: log.length,
        log: log
      });
    });
  });
});

// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
