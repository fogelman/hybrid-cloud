const yup = require('yup');
const Tarefa = require('./../models/tarefa');

const schema = yup.object().shape({
  title: yup.string().required(),
  description: yup.string().required(),
  done: yup.bool().default(false),
});

class TarefaController {
  async store(req, res) {
    console.log(req.body);
    if (!(await schema.isValid(req.body))) {
      return res
        .status(400)
        .json({ error: 'Erro na validação do conteúdo do body' });
    }

    const tarefa = await Tarefa.create(req.body);
    return res.json(tarefa);
  }

  async show(req, res) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Erro na validação do conteúdo' });
    }

    const tarefa = await Tarefa.findById(id);
    return res.status(200).json(tarefa);
  }
  async list(req, res) {
    const tarefa = await Tarefa.find({});
    return res.json(tarefa);
  }

  async delete(req, res) {
    const tarefa = await Tarefa.findByIdAndDelete(req.params.id);
    return res.json({});
  }

  async update(req, res) {
    if (!(await schema.isValid(req.body))) {
      return res
        .status(400)
        .json({ error: 'Erro na validação do conteúdo do body' });
    }

    const tarefa = await Tarefa.findOne({ _id: req.params.id }, (err, doc) => {
      if (err) {
        return res.status(400).json({ error: 'Erro ao fazer update' });
      }

      doc.value = req.body.value;

      doc.save(function(err) {
        if (err) {
          return res.status(400).json({ error: 'Erro ao fazer update' });
        }
        return res.json(doc);
      });
    });
  }
}

module.exports = new TarefaController();
