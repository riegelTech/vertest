# How to install Vertest ?

## Configuration

To configure your application, create a yaml file at ` <YOUR_APP_DIR>/config.yml` . To help you
to use correct sections and entries, you have a sample file named `config-sample.yml`.

Note that if no `config.yml` file is found, application will use `config-sample.yml` file instead.

> Please read the [detailed configuration documentation](configuration.md) before going further.

## Installation

To run vertest, you just need to install [docker](https://docs.docker.com/engine/install/) and [docker-compose](https://docs.docker.com/compose/install/).

Then clone the GIT repository or get an archive of the codebase.
```bash
$ git clone https://github.com/riegelTech/vertest.git
$ cd vertest
```

Install all nodeJS modules, using npm :

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

Once the frontend is built, just type 
```bash
$ docker-compose up
```

## Maintenance

### Backup

There is no official backup script, even if a `rollbak_demo.sh` script exists and help me to maintain
 the demo server, doing backups and restorations automatically.

The most important thing to know is that the data are located in three places :

1. MongoDB
2. the `repositoriesDir` directory (see the [configuration documentation](configuration.md))
3. the logs directory (see the [configuration documentation](configuration.md))

To dump the repositories and the logs, I let you make an archive or a deep copy of the directories.

To dump the database, you have to exec the dump MongoDB command in the corresponding docker container.

1. Ensure the mongodb container is running, if not, type: `$ docker-compose up mongo`
2. Get the container name `$ docker-compose ps | grep mongod | grep -Eo "^([A-Za-z0-9_-]*)"`
3. Execute the dump command `$ docker exec "[YOUR_CONTAINER_NAME]" bash -c "cd /data/db/ && mongodump -d vertest -c users -o ./ && mongodump -d vertest -c testSuites -o ./"`
4. You can now find in `mongoData` a new directory called `vertest` that contains the dump

> Note that this will probably require super user rights

### Restoring

To restore the logs and the repositories, just replace all dedicated directories content by the backup.

To restore the database, you have to exec the restore MongoDB command in the corresponding docker container.

1. Copy the dump directory `vertest` in the `mongoData` directory
2. Ensure the mongodb container is running, if not, type: `$ docker-compose up mongo`
3. Get the container name `$ docker-compose ps | grep mongod | grep -Eo "^([A-Za-z0-9_-]*)"`
4. Execute the restore command `docker exec "[YOUR_CONTAINER_NAME]" bash -c "cd /data/db/ && mongorestore -d vertest -c testSuites --drop vertest/testSuites.bson && mongorestore -d vertest -c users --drop vertest/users.bson"`
5. Now stop the container and restart `docker-compose down && docker-compose up`

> Note that this will probably require super user rights
