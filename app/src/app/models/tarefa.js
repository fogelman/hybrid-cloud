const mongoose = require('mongoose');

const tarefaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    done: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'tarefa',
  }
);

module.exports = mongoose.model('tarefa', tarefaSchema);
