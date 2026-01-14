const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');
const md5 = require('md5');
const ganache = require("ganache");
const Web3 = require("web3");
const fs = require("fs");
const solc = require("solc");

const app = express();
const PORT = 3000;

// Ganache Setup
const ganacheOptions = {
    logging: { quiet: true }
};
const ganacheServer = ganache.server(ganacheOptions);

async function setupBlockchain() {
    return new Promise((resolve, reject) => {
        ganacheServer.listen(7545, async (err) => {
            if (err) return reject(err);
            console.log("Ganache Blockchain running on port 7545");

            try {
                const web3 = new Web3("http://127.0.0.1:7545");
                const accounts = await web3.eth.getAccounts();
                const deployerAccount = accounts[0];
                console.log("Deploying contract with account:", deployerAccount);

                // Read Contract
                const contractSource = fs.readFileSync(path.join(__dirname, 'smartcontract', 'smartcontract.sol'), 'utf8');

                // Compile Contract (Simple solc usage)
                var input = {
                    language: 'Solidity',
                    sources: {
                        'smartcontract.sol': {
                            content: contractSource
                        }
                    },
                    settings: {
                        outputSelection: {
                            '*': {
                                '*': ['*']
                            }
                        }
                    }
                };

                const output = JSON.parse(solc.compile(JSON.stringify(input)));
                const contractABI = output.contracts['smartcontract.sol']['SupplyChain'].abi;
                const contractBytecode = output.contracts['smartcontract.sol']['SupplyChain'].evm.bytecode.object;

                // Deploy
                const contract = new web3.eth.Contract(contractABI);
                const deployedContract = await contract.deploy({
                    data: contractBytecode
                }).send({
                    from: deployerAccount,
                    gas: 1500000,
                    gasPrice: '30000000000'
                });

                console.log("Contract deployed at address:", deployedContract.options.address);

                // Update app.js
                let appJspath = path.join(__dirname, 'app.js');
                let appJsContent = fs.readFileSync(appJspath, 'utf8');

                // Update Address
                appJsContent = appJsContent.replace(/var contractAddress ='.*';/, `var contractAddress ='${deployedContract.options.address}';`);

                // Update ABI
                // We need to inject the new ABI as well just in case
                const abiString = JSON.stringify(contractABI, null, 2);
                appJsContent = appJsContent.replace(/var contractAbi =\[[\s\S]*?\];/, `var contractAbi =${abiString};`);

                fs.writeFileSync(appJspath, appJsContent);
                console.log("Updated app.js with new contract address and ABI.");

                resolve();
            } catch (e) {
                console.error("Error deploying contract:", e);
                resolve(); // Continue anyway
            }
        });
    });
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files from root
app.set('view engine', 'ejs');
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// Routes

app.get('/', (req, res) => {
    if (req.session.role !== undefined) {
        res.redirect('/checkproducts');
    } else {
        res.render('index', { role: undefined, error: null });
    }
});

app.post('/login', (req, res) => {
    const email = req.body.email;
    const password = md5(req.body.pw);

    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
        if (err) {
            res.render('index', { role: undefined, error: "Database error" });
        } else if (row) {
            req.session.role = row.role;
            req.session.username = row.username;
            req.session.email = row.email;
            res.redirect('/checkproducts');
        } else {
            res.render('index', { role: undefined, error: "Please check your Email and Password and try again." });
        }
    });
});

app.post('/registration', (req, res) => {
    const email = req.body.email;
    const username = req.body.username;
    const password = md5(req.body.pw); // Note: original code used 'pw', check form field name
    const role = req.body.role;

    // Check if user exists? Simple prototype implementation
    db.run("INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, ?)", [email, username, password, role], function (err) {
        if (err) {
            res.render('index', { role: undefined, error: "Registration failed. Email might be taken." });
        } else {
            // Auto login or redirect to login? Original redirects to index (login form)
            res.render('index', { role: undefined, error: "Registration successful! Please login." });
        }
    });
});

app.get('/checkproducts', (req, res) => {
    if (req.session.role === undefined) {
        res.redirect('/');
    } else {
        res.render('checkproducts', { role: req.session.role });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Basic placeholders for other pages to prevent 404
app.get('/addproducts', (req, res) => {
    if (req.session.role === undefined) res.redirect('/');
    else res.send("Add Products Page (Not fully ported yet, but auth works)");
});
app.get('/scanshipment', (req, res) => {
    if (req.session.role === undefined) res.redirect('/');
    else res.send("Ownership Transfer Page (Not fully ported yet)");
});
app.get('/profile', (req, res) => {
    if (req.session.role === undefined) res.redirect('/');
    else res.send("Profile Page (Not fully ported yet)");
});


// Start
setupBlockchain().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
