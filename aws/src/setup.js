#!/usr/bin/env node
const argv = require('yargs');
const fs = require('fs');

argv.version('1.1.0');

argv.command({
  command: '',
  describe: 'Add new todo',
  aliases: [],
  builder: {
    title: {
      describe: 'Todo title',
      demandOption: true,
      type: 'string',
      alias: 't',
    },
    description: {
      describe: 'Description of todo',
      demandOption: true,
      type: 'string',
      alias: 'd',
    },
    done: {
      describe: 'Status of todo',
      demandOption: false,
      type: 'boolean',
      default: false,
    },
  },
  strict: true,
  handler: async argv => {
    const { title, description, done } = argv;
    tarefa.add(title, description, done);
    return;
  },
});

argv
  .help()
  .locale('en')
  .alias('help', 'h')
  .alias('version', 'v')
  .demandCommand(1, 'You have to select at least one command to continue!')
  .showHelpOnFail(true)
  .detectLocale(true)
  .strict()
  .recommendCommands().argv;
