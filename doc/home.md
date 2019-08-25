# Home

## How to start your application

Install all dependencies, using npm :

```bash
$ npm install
```

Build front-end application :

```bash
$ npm run build
```

Then uninstall development modules :

```bash
$ npm prune --production
```

Using docker-compose, start all services :

```bash
$ docker-compose up
```

You ca now open URL `http://localhost:8080` in your browser.

As users database is empty, you will be redirected to URL `http://localhost:8080/init/`, so you can define
super-user password.

Super-user login is **admin**. There is only one super-user, and it is the only user allowed to create, edit
or delete all other users.

## How to develop

First, start mongoDb service, using docker-compose :

```bash
$ docker-compose -f docker-compose-dev.yml up
```

Then build front end application, using webpack, with a watcher :

```bash
$ npm run dev
```

Finally start back-end application :

```bash
$ npm start
```

## How to reinit database

To clean all the database, just stop all services :

```bash
$ docker-compose down
```
When it is done, remove all files and directory inside `./mongoData` directory :

```bash
$ sudo rm -rf mongoData/*
```

It will suppress all your data, so be aware. You have to be root or sudoer to do that, as default
user of mongoDb Docker image is root.
