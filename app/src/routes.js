const express = require('express');
const routes = express.Router();
const tarefaController = require('./app/controllers/tarefa');

routes.get('/', tarefaController.list);
routes.post('/', tarefaController.store);
routes.get('/:id', tarefaController.show);
routes.put('/:id', tarefaController.update);
routes.delete('/:id', tarefaController.delete);

module.exports = routes;
