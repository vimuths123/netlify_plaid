const express = require("express");
const serverless = require("serverless-http");

const app = express();
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    hello: "hi!"
  });
});

app.use(`/.netlify/functions/api`, router);

module.exports = app;
module.exports.handler = serverless(app);

const PORT = process.env.APPPORT || 9000

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`)
}) 