const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Poke Ball Game Server is running!`);
  console.log(` Access the game at: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
