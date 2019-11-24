# TODO (client)

## usage

Copy the `.env.example` file to `.env` and fill in the variables

```
cp .env.example .env
```

Download the dependecies and add execution permission to the `todo` file

```
npm i
chmod +x todo
```

Execute the script

```
./todo -h
```

## examples:

- Add new todo `./todo add -t "Homework" -d "Homework about ..."`
- Remove a todo `./todo remove <id>"`
