const express = require('express');
const routes = require('./routes');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

class App {
  constructor() {
    this.server = express();
    this.middlewares();
    this.routes();
    // this.database();
  }
  middlewares() {
    this.server.use(cors());
    this.server.use(express.json());
  }
  routes() {
    this.server.use('/tarefa', routes);

    this.server.use('/healthcheck', (req, res) => {
      if (process.env.MONGO_URI) {
        return res.status(200).send(process.env.MONGO_URI);
      }
      return res.status(200).send();
    });

    this.server.use((req, res) => {
      return res.status(404).json({ error: 'página não encontrada' });
    });

    this.server.use((error, req, res, next) => {
      return res.status(500).json({ error: 'erro interno' });
    });
  }

  database() {
    mongoose.connect(process.env.MONGO_URI, {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 30000,
    });
  }
}

module.exports = new App();
