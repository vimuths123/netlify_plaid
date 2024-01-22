const express = require("express");
const serverless = require("serverless-http");

require("dotenv").config();
const bodyParser = require("body-parser");
const session = require("express-session");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const path = require("path");
const cors = require('cors');

const app = express();
const router = express.Router();

app.use(cors());

app.use(
  session({ secret: "bosco", saveUninitialized: true, resave: true })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
  // res.json({
  //   message: "Neuralleap API works"
  // });
});


router.get("/transactions", async (req, res) => {
  res.sendFile(path.join(__dirname, "transactions.html"));
});

router.get("/oauth", async (req, res) => {
  res.sendFile(path.join(__dirname, "oauth.html"));
});

// Configuration for the Plaid client
const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});

//Instantiate the Plaid client with the configuration
const client = new PlaidApi(config);

//Creates a Link token and return it
router.get("/api/create_link_token", async (req, res, next) => {
  const tokenResponse = await client.linkTokenCreate({
    user: { client_user_id: req.sessionID },
    client_name: "Plaid's Tiny Quickstart",
    language: "en",
    products: ["auth"],
    country_codes: ["US"],
    redirect_uri: process.env.PLAID_SANDBOX_REDIRECT_URI,
  });
  res.json(tokenResponse.data);
});

// Exchanges the public token from Plaid Link for an access token
router.post("/api/exchange_public_token", async (req, res, next) => {
  const exchangeResponse = await client.itemPublicTokenExchange({
    public_token: req.body.public_token,
  });

  // FOR DEMO PURPOSES ONLY
  // Store access_token in DB instead of session storage
  req.session.access_token = exchangeResponse.data.access_token;
  // res.json(true);
  res.json({
    'access_token': exchangeResponse.data.access_token
  });
});

// Fetches balance data using the Node client library for Plaid
router.get("/api/data", async (req, res, next) => {
  const access_token = req.session.access_token;
  const balanceResponse = await client.accountsBalanceGet({ access_token });
  res.json({
    Balance: balanceResponse.data,
  });
});

router.post("/api/data2", async (req, res, next) => {
  try {
    const access_token = req.body.access_token;
    if (!access_token) {
      return res.status(400).json({ error: "access_token is required" });
    }
    const balanceResponse = await client.accountsBalanceGet({ access_token });

    res.json({
      Balance: balanceResponse.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =======================================
const endDate = new Date();
const startDate = new Date();
startDate.setMonth(endDate.getMonth() - 3);

function formatDate(date) {
  let day = date.getDate();
  let month = date.getMonth() + 1;
  let year = date.getFullYear();

  month = month < 10 ? `0${month}` : month;
  day = day < 10 ? `0${day}` : day;

  return `${year}-${month}-${day}`;
}

const formattedStartDate = formatDate(startDate);
const formattedEndDate = formatDate(endDate);

// =======================================


router.post("/api/three_months_transactions", async (req, res, next) => {

  const accountId = req.body.accountId;

  if (!accountId) {
    return res.status(400).send('Account ID is required');
  }

  const accountIds = [accountId];

  const access_token = req.body.access_token;
  if (!access_token) {
    return res.status(400).json({ error: "access_token is required" });
  }

  const request = {
    access_token: access_token,
    start_date: formattedStartDate,
    end_date: formattedEndDate,
    options: {
      account_ids: accountIds
    }
  };

  try {
    const response = await client.transactionsGet(request);
    let transactions = response.data.transactions;
    const total_transactions = response.data.total_transactions;

    res.json(transactions);

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send('An error occurred while fetching transactions');
  }
});


router.get("/api/transactions", async (req, res, next) => {
  // Check if access_token exists in the session
  if (!req.session.access_token) {
    console.error('Access token is missing from the session');
    res.status(400).send('Access token is missing');
    return;
  }

  console.log(req.session.access_token)

  const request = {
    access_token: req.session.access_token,
    start_date: '2018-01-01',
    end_date: '2024-01-30'
  };

  try {
    const response = await client.transactionsGet(request);
    let transactions = response.data.transactions;
    const total_transactions = response.data.total_transactions;

    while (transactions.length < total_transactions) {
      const paginatedRequest = {
        access_token: req.session.access_token,
        start_date: '2018-01-01',
        end_date: '2024-01-16',
        options: {
          offset: transactions.length
        },
      };

      const paginatedResponse = await client.transactionsGet(paginatedRequest);
      transactions = transactions.concat(paginatedResponse.data.transactions);
    }

    // Send transactions back to the client
    res.json(transactions);

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send('An error occurred while fetching transactions');
  }
});

router.get("/api/is_account_connected", async (req, res, next) => {
  return (req.session.access_token ? res.json({ status: true }) : res.json({ status: false }));
});


app.use(`/.netlify/functions/api`, router);


module.exports = app;
module.exports.handler = serverless(app);

const PORT = process.env.APPPORT || 9000

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`)
})

