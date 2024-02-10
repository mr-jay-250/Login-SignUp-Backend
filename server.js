const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'YOUR_PASSWORD',
  database: 'user_journey',
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to database');
});

// Create table if not exists
db.query(
  'CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255), password VARCHAR(255), age INT, dob DATE, contact VARCHAR(15))',
  (err) => {
    if (err) throw err;
    console.log('Users table created');
  }
);

// Middleware to authenticate user using JWT
const authenticateUser = (req, res, next) => {
  const token = req.header('Authorization');
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), 'yourSecretKey'); // Replace 'yourSecretKey' with your actual secret key
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
  }
};

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(sql, [username, password], (err, result) => {
    if (err) throw err;
    if (result.length > 0) {
      const user = result[0];
      const token = jwt.sign({ id: user.id, username: user.username }, 'yourSecretKey', { expiresIn: '1h' });
      res.json({ success: true, message: 'Login successful', token });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  });
});

// Signup API
app.post('/api/signup', (req, res) => {
  const { username, password, age, dob, contact } = req.body;
  const sql = 'INSERT INTO users (username, password, age, dob, contact) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [username, password, age, dob, contact], (err, result) => {
    if (err) throw err;

    // Retrieve the user ID after signup
    db.query('SELECT id FROM users WHERE username = ?', [username], (selectErr, selectResult) => {
      if (selectErr) throw selectErr;

      if (selectResult.length > 0) {
        const userId = selectResult[0].id;
        const token = jwt.sign({ id: userId, username }, 'yourSecretKey', { expiresIn: '1h' });
        res.json({ success: true, message: 'User registered successfully', token });
      } else {
        res.json({ success: false, message: 'Error retrieving user information after signup' });
      }
    });
  });
});

// Get user details API (protected route, requires authentication)
app.get('/api/userDetails', authenticateUser, (req, res) => {
  const userId = req.user.id;

  // Fetch user details from the database using userId
  db.query('SELECT * FROM users WHERE id = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error fetching user details:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result[0];
    const userDetails = {
      id: user.id,
      username: user.username,
      age: user.age,
      dob: user.dob,
      contact: user.contact,
    };

    res.json({ success: true, user: userDetails });
  });
});

// Edit user details API
app.put('/api/editUserDetails/:id', (req, res) => {
  const userId = req.params.id;
  const { age, dob, contact } = req.body;

  // Check if the user exists
  db.query('SELECT * FROM users WHERE id = ?', [userId], (selectErr, selectResult) => {
    if (selectErr) {
      console.error('Error selecting user:', selectErr);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (selectResult.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update user details
    db.query(
      'UPDATE users SET age = ?, dob = ?, contact = ? WHERE id = ?',
      [age, dob, contact, userId],
      (updateErr) => {
        if (updateErr) {
          console.error('Error updating user details:', updateErr);
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        res.json({ success: true, message: 'User details updated successfully' });
      }
    );
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
