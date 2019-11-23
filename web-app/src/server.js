const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const routes = require('./routes');

class App {
  constructor() {
    this.server = express();
    this.middlewares();
    this.routes();
  }
  middlewares() {
    this.server.use(cors());
    this.server.use(express.json());
  }
  routes() {
    this.server.use('/tarefa', routes);

    this.server.use('/healthcheck', (req, res) => {
      return res.status(200).send();
    });

    this.server.use((req, res) => {
      return res.status(404).json({ error: 'página não encontrada' });
    });

    this.server.use((error, req, res, next) => {
      return res.status(500).json({ error: 'erro interno' });
    });
  }
}

module.exports = new App();
