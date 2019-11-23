const yup = require('yup');
const api = require('./../services/api');

const schemaAdd = yup.object().shape({
  title: yup.string().required(),
  description: yup.string().required(),
  done: yup.bool().default(false),
});

const schemaUpdate = yup.object().shape({
  title: yup.string(),
  description: yup.string(),
  done: yup.bool(),
});

class TarefaController {
  async store(req, res) {
    try {
      if (!(await schemaAdd.isValid(req.body))) {
        return res
          .status(400)
          .json({ error: 'Erro na validação do conteúdo do body' });
      }

      const tarefa = await api
        .post('/tarefa', req.body)
        .then(({ data }) => data);
      return res.json(tarefa);
    } catch (e) {
      return res.status(400).json({ error: 'Erro na requisição' });
    }
  }

  async show(req, res) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Erro na validação do conteúdo' });
    }

    try {
      const tarefa = await api.get(`/tarefa/${id}`).then(({ data }) => data);
      return res.status(200).json(tarefa);
    } catch (e) {
      console.error(e);
      return res.status(400).json({ error: 'Erro na requisição' });
    }
  }
  async list(req, res) {
    try {
      const tarefa = await api.get('/tarefa').then(({ data }) => data);
      return res.json(tarefa);
    } catch (e) {
      console.error(e);
      return res.status(400).json({ error: 'Erro na requisição' });
    }
  }

  async delete(req, res) {
    try {
      await api.delete(`/tarefa/${req.params.id}`);
      return res.json({});
    } catch (e) {
      return res.status(400).json({ error: 'Erro na requisição' });
    }
  }

  async update(req, res) {
    try {
      if (!(await schemaUpdate.isValid(req.body))) {
        return res
          .status(400)
          .json({ error: 'Erro na validação do conteúdo do body' });
      }
      await api.put(`/tarefa/${req.params.id}`, req.body);
      return res.json({});
    } catch (e) {
      return res.status(400).json({ error: 'Erro na requisição' });
    }
  }
}

module.exports = new TarefaController();
