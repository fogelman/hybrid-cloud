const yup = require('yup');
const Tarefa = require('./../models/tarefa');

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

      const tarefa = await Tarefa.create(req.body);
      return res.json(tarefa);
    } catch (e) {
      console.log(e);
    }
  }

  async show(req, res) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Erro na validação do conteúdo' });
    }

    try {
      const tarefa = await Tarefa.findById(id);
      return res.status(200).json(tarefa);
    } catch (e) {
      console.log(e);
    }
  }
  async list(req, res) {
    try {
      const tarefa = await Tarefa.find({});
      return res.json(tarefa);
    } catch (e) {
      console.log(e);
    }
  }

  async delete(req, res) {
    try {
      const tarefa = await Tarefa.findByIdAndDelete(req.params.id);
      return res.json({});
    } catch (e) {
      console.log(e);
    }
  }

  async update(req, res) {
    console.log(req.body);

    const { title, description, done } = req.body;
    try {
      if (!(await schemaUpdate.isValid(req.body))) {
        return res
          .status(400)
          .json({ error: 'Erro na validação do conteúdo do body' });
      }

      await Tarefa.findOne({ _id: req.params.id }, (err, doc) => {
        if (err) {
          return res.status(400).json({ error: 'Erro ao fazer update' });
        }

        doc.title = title ? title : doc.title;
        doc.done = done ? done : doc.done;
        doc.description = description ? description : doc.description;

        doc.save(function(err) {
          if (err) {
            return res.status(400).json({ error: 'Erro ao fazer update' });
          }
          return res.json(doc);
        });
      });
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = new TarefaController();
