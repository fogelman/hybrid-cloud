#!/usr/bin/env node
const argv = require("yargs");
const tarefa = require("./api");
// demand an array of keys to be provided
argv.version("1.1.0");

argv.command({
  command: "add",
  describe: "Add new todo",
  aliases: ["a"],
  builder: {
    title: {
      describe: "Todo title",
      demandOption: true,
      type: "string",
      alias: "t"
    },
    description: {
      describe: "Description of todo",
      demandOption: true,
      type: "string",
      alias: "d"
    },
    done: {
      describe: "Status of todo",
      demandOption: false,
      type: "boolean",
      default: false
    }
  },
  strict: true,
  handler: async argv => {
    const { title, description, done } = argv;
    tarefa.add(title, description, done);
    return;
  }
});

argv.command({
  command: "list",
  aliases: ["l"],
  desc: "List all todos",
  strict: true,
  handler: async argv => {
    console.log(await tarefa.list());
    return;
  }
});

argv.command({
  command: "search [id]",
  aliases: ["s"],
  desc: "Search todo by id",

  builder: {
    id: {
      describe: "Todo title",
      demandOption: true,
      type: "string"
    }
  },
  strict: true,
  handler: async argv => {
    const { id } = argv;
    if (!id) {
      throw "missing argument id";
    }

    console.log(await tarefa.get(id));
  }
});

argv.command({
  command: "update [id]",
  describe: "Update new todo",
  aliases: ["u"],
  builder: {
    id: {
      describe: "Todo title",
      demandOption: true,
      type: "string"
    },
    title: {
      describe: "Todo title",
      demandOption: false,
      type: "string",
      alias: "t"
    },
    description: {
      describe: "Description of todo",
      demandOption: false,
      type: "string",
      alias: "d"
    },
    done: {
      describe: "Status of todo",
      demandOption: false,
      type: "boolean",
      default: false
    }
  },
  handler: async argv => {
    const { id, title, description, done } = argv;

    tarefa.update(id, title, description, done);
    return;
  }
});
argv.command({
  command: "delete [id]",
  aliases: ["d"],
  builder: {
    id: {
      describe: "Todo title",
      demandOption: true,
      type: "string"
    }
  },
  desc: "Delete todo by id",
  handler: async argv => {
    const { id } = argv;

    await tarefa.delete(id);
    console.log(`todo ${id} erased`);
  },
  strict: true
});

argv
  .help()
  .locale("en")
  .alias("help", "h")
  .alias("version", "v")
  .demandCommand(1, "You have to select at least one command to continue!")
  .showHelpOnFail(true)
  .detectLocale(true)
  .strict()
  .recommendCommands().argv;
