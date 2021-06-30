# Home

Vertest use nodeJS on the backend, and VueJS + webpack on the frontend.

## How to develop

To be fully comfortable, I strongly recommend to have a terminal per running part :

* The database
* The frontend builder
* The backend

### The database

First, start mongoDb service, using docker-compose :

```bash
$ docker-compose -f docker-compose-dev.yml up
```

### The frontend builder

Then build continuously front end application, using webpack, with a watcher :

```bash
$ npm run dev
```

### Backend

Finally start back-end application :

```bash
$ npm start
```
Or just
```bash
$ node app/index.js
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
