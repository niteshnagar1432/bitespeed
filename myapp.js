const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const {
    route
} = require('./routes');

const app = express();

// Create a connection pool to the MySQL database
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bitspeed',
});

// Middleware to parse JSON bodies
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send(`<form action="/identify" method="post">
    <input type="text" name="email">
    <input type="text" name="phoneNumber">
    <button type="submit">Submit</button>
  </form>`);
})

// Endpoint /identify
app.post('/identify', (req, res) => {
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
    const query = `SELECT * FROM Contact WHERE email = ? OR phoneNumber = ?`;
    pool.query(query, [email, phoneNumber], (err, results) => {
        if (err) {
            console.error('Error executing the query:', err);
            return res.status(500).json({
                error: 'Internal server error.',
            });
        }

        if (results.length > 0) {
            const contact = results[0];
            const primaryId = contact.linkedId;

            // Step 2: Check if it is a primary or secondary contact
            if (contact.linkPrecedence === 'primary') {
                // Step 3: Retrieve all secondary contacts linked to it
                const secondaryQuery = `SELECT * FROM Contact WHERE linkedId = ?`;
                pool.query(secondaryQuery, [contact.id], (err, secondaryResults) => {
                    if (err) {
                        console.error('Error executing the secondary query:', err);
                        return res.status(500).json({
                            error: 'Internal server error.',
                        });
                    }

                    // Consolidate the contacts as per the rules
                    const consolidatedContact = {
                        primaryContactId: contact.id,
                        emails: [contact.email],
                        phoneNumbers: [contact.phoneNumber],
                        secondaryContactIds: secondaryResults.map((secondary) => secondary.id),
                    };

                    return res.status(200).json({
                        contact: consolidatedContact,
                    });
                });
            } else {
                // Step 4: Retrieve the primary contact it is linked to
                const primaryQuery = `SELECT * FROM Contact WHERE id = ?`;
                pool.query(primaryQuery, [primaryId], (err, primaryResult) => {
                    if (err) {
                        console.error('Error executing the primary query:', err);
                        return res.status(500).json({
                            error: 'Internal server error.',
                        });
                    }

                    // Step 5: Retrieve all other secondary contacts linked to that primary contact
                    const secondaryQuery = `SELECT * FROM Contact WHERE linkedId = ?`;
                    pool.query(secondaryQuery, [primaryId], (err, secondaryResults) => {
                        if (err) {
                            console.error('Error executing the secondary query:', err);
                            return res.status(500).json({
                                error: 'Internal server error.',
                            });
                        }

                        // Consolidate the contacts as per the rules
                        const consolidatedContact = {
                            primaryContactId: primaryResult[0].id,
                            emails: [primaryResult[0].email],
                            phoneNumbers: [primaryResult[0].phoneNumber],
                            secondaryContactIds: secondaryResults.map((secondary) => secondary.id),
                        };

                        return res.status(200).json({
                            contact: consolidatedContact,
                        });
                    });
                });
            }
        } else {
            // Step 6: If the contact does not exist, create a new primary contact in the database
            const createQuery = `INSERT INTO contacts (phoneNumber, email, linkPrecedence) VALUES (?, ?, ?)`;
            pool.query(createQuery, [phoneNumber, email, 'primary'], (err, createResult) => {
                if (err) {
                    console.error('Error creating the new primary contact:', err);
                    return res.status(500).json({
                        error: 'Internal server error.',
                    });
                }

                // Get the newly created contact's ID
                const newContactId = createResult.insertId;

                // Check if there is an existing contact with the provided email or phone number
                const existingContactQuery = `SELECT * FROM contacts WHERE email = ? OR phoneNumber = ?`;
                pool.query(existingContactQuery, [email, phoneNumber], (err, existingContactResults) => {
                    if (err) {
                        console.error('Error checking for existing contact:', err);
                        return res.status(500).json({
                            error: 'Internal server error.',
                        });
                    }

                    if (existingContactResults.length > 0) {
                        // Link the new contact as a secondary contact to the existing contact
                        const linkSecondaryQuery = `INSERT INTO contacts (phoneNumber, email, linkedId, linkPrecedence) VALUES (?, ?, ?, ?)`;
                        pool.query(
                            linkSecondaryQuery,
                            [phoneNumber, email, existingContactResults[0].id, 'secondary'],
                            (err) => {
                                if (err) {
                                    console.error('Error creating a new secondary contact:', err);
                                    return res.status(500).json({
                                        error: 'Internal server error.',
                                    });
                                }

                                return res.status(200).json({
                                    primaryContactId: existingContactResults[0].id,
                                    emails: [existingContactResults[0].email, email],
                                    phoneNumbers: [existingContactResults[0].phoneNumber, phoneNumber],
                                    secondaryContactIds: [newContactId],
                                });
                            }
                        );
                    } else {
                        // New primary contact without any secondary contacts
                        return res.status(200).json({
                            primaryContactId: newContactId,
                            emails: [email],
                            phoneNumbers: [phoneNumber],
                            secondaryContactIds: [],
                        });
                    }
                });
            });
        }
    });
});

module.exports = router;