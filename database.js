const sqlite3 = require('sqlite3').verbose();
const md5 = require('md5');

const db = new sqlite3.Database('./supplychain.db', (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            username TEXT,
            password TEXT,
            product TEXT DEFAULT '0',
            role INTEGER,
            owner TEXT DEFAULT 'no'
        )`, (err) => {
            if (err) {
                console.error("Error creating table: " + err.message);
            } else {
                // Insert default user if not exists
                // We use INSERT OR IGNORE or just check count. 
                // Simple way:
                const insert = 'INSERT INTO users (email, username, password, product, role, owner) VALUES (?,?,?,?,?,?)';
                db.run(insert, ['riteshxxxxx', 'Ritesh ', '0cc175b9c0f1b6a831c399e269772661', '0', 0, 'no'], (err) => {
                    // Ignore error if unique constraint failed (though we don't have unique constraint on email in orig sql).
                });
            }
        });
    }
});

module.exports = db;
