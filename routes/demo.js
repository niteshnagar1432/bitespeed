const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const bodyParser = require('body-parser');

// Create a connection pool to the MySQL database
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'bitspeed',
});

// Middleware to parse JSON bodies
router.use(bodyParser.json());

router.get('/', (req, res) => {
  res.render('index');
});

// Endpoint /identify
router.post('/identify', (req, res) => {
  const {
    email,
    phoneNumber
  } = req.body;

  // Check if email or phoneNumber is provided in the request body
  if (!email && !phoneNumber) {
    return res.status(400).json({
      error: 'Email or phoneNumber must be provided in the request body.',
    });
  }

  // Step 1: Check if the provided email or phoneNumber exists in the database
  const query = `SELECT * FROM contacts WHERE email = '${email}' AND phoneNumber = '${phoneNumber}'`;
  pool.query(query, [email, phoneNumber], (err, results) => {
    if (err) {
      console.error('Error executing the query:', err);
      return res.status(500).json({
        error: 'Internal server error.',
      });
    }

    if (results.length > 0) {
      //check if user alredy exist or not using email or phoneNumber
      const UserAlredyExist = `SELECT * FROM contacts WHERE email = '${email}' OR phoneNumber = '${phoneNumber}'`;
      pool.query(UserAlredyExist, [email, phoneNumber], (err, result) => {
        if (err) {
          console.error('Error executing the query:', err);
          return res.status(500).json({
            error: 'Internal server error.',
          });
        }

        if (result.length == 1) {
          res.status(200).json({
            'single': result
          });

        } else {
          var Nemails = isSame(result[0].email,result[1].email);
          var Nphones = isSame(result[0].phoneNumber,result[1].phoneNumber);
          res.status(200).json({
            'contact':{
              'primaryContatctId':[result[0].id],
              'emails':Nemails,
              'phoneNumber':Nphones,
              'secondaryContactIds':[result[1].id]
            }
          });
        }
      })
    } else {
      const UserAlredyExist = `SELECT * FROM contacts WHERE email = '${email}' OR phoneNumber = '${phoneNumber}'`;
      pool.query(UserAlredyExist, [email, phoneNumber], (err, results) => {
        if (results.length == 1) {
          const UpdateQuery = `INSERT INTO contacts (phoneNumber, email,	linkedId, linkPrecedence) VALUES ('${phoneNumber}', '${email}',${results[0].id}, 'secondary')`;
          pool.query(UpdateQuery, [phoneNumber, email, results[0].id, 'secondary'], (err, resu) => {
            if (err) {
              return res.status(500).json({
                error: 'Internal Server Error.',
              });
            }
            const UpdatePrimaryContact = `UPDATE contacts SET linkedId = '${resu.insertId}' WHERE id = ${results[0].id};`;
            pool.query(UpdatePrimaryContact, [resu.insertId, results[0].id], (err, result) => {
              if (err) {
                console.log('err');
              } else {
                const UserAlredyExist = `SELECT * FROM contacts WHERE email = '${email}' OR phoneNumber = '${phoneNumber}'`;
                pool.query(UserAlredyExist, [email, phoneNumber], (err, result) => {
                  if (err) {
                    console.error('Error executing the query:', err);
                    return res.status(500).json({
                      error: 'Internal server error.',
                    });
                  }
                  res.status(200).json({
                    result
                  });
                });
              }
            })
          })
        } else {
          const createQuery = `INSERT INTO contacts (phoneNumber, email, linkPrecedence) VALUES ('${phoneNumber}', '${email}', 'primary')`;
          pool.query(createQuery, [phoneNumber, email, 'primary'], (err, result) => {
            if (err) {
              console.error('Error creating the new contact:', err);
              return res.status(500).json({
                error: 'Internal server error.'
              });
            }
            const UserAlredyExist = `SELECT * FROM contacts WHERE email = '${email}' OR phoneNumber = '${phoneNumber}'`;
            pool.query(UserAlredyExist, [email, phoneNumber], (err, result) => {
              if (err) {
                console.error('Error executing the query:', err);
                return res.status(500).json({
                  error: 'Internal server error.',
                });
              }
              res.status(200).json({
                 result
              });
            });
          });
        }
      });
    }

  });
});

function isSame(val_1,val_2){
  if(val_1 == val_2){
    return [val_1];
  }else{
    return [val_1,val_2];
  }
}

module.exports = router;