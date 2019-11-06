const app = require('./server');
const PORT = process.env.PORT || 3333;

app.server.listen(PORT, () => {
  if (process.env.NODE_ENV === 'dev') {
    console.log(`Running on port ${PORT}`);
  }
});
