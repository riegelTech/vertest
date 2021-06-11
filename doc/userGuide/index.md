# Vertest user guide

Welcome into the Vertest user guide !

### Installation 

[How to install and configure Vertest ?](./installation.md)

### First start of the application

```bash
$ docker-compose up
```

You ca now open URL `http://localhost:[CONFIGURED_PORT]` in your browser.

As users database is empty, you will be redirected to URL `http://localhost:[CONFIGURED_PORT]/init/`, so you can define
super-user password.

Super-user login is **admin**. There is only one super-user, and it is the only user allowed to create, edit
or delete all other users.

## Manage users

## Manage SSH keys

## Create a test suite

## Test suite lifecycle

## Advanced tricks