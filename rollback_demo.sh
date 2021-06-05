#!/bin/bash

#****************************************************
# online demo site needs to be regularly cleaned    *
# this file will rollback all data contained into   *
# backup dir                                        *
#****************************************************

# 1- get the id of the running mongo container
CONTAINER_NAME=$(docker-compose ps | grep mongod | grep -Eo "^([A-Za-z0-9_-]*)")

function restore() {
    echo "Restoring backup..."
    # 2- restore the backups
    cp -R ./backup/mongo/vertest mongoData/
    chmod -R a+r mongoData/vertest
    docker exec -ti "$CONTAINER_NAME" bash -c "cd /data/db/ && mongorestore -d vertest -c testSuites --drop vertest/testSuites.bson && mongorestore -d vertest -c users --drop vertest/users.bson"

    # 3- restore the logs
    rm -rf ./logs/*
    cp -R ./backup/logs/* ./logs/

    # 4- restore the git dirs
    rm -rf ./cloneDir/*
    cp -R ./backup/repos/* ./cloneDir/

    # 5- restart the docker containers to refresh all data
    docker-compose down
    docker-compose -f ./docker-compose.yml up > /dev/null 2>&1 &
}

function backup() {
    echo "Creating backup..."
    # 2- clean data backup and dump
    rm -rf mongoData/vertest
    docker exec -ti "$CONTAINER_NAME" bash -c "cd /data/db/ && mongodump -d vertest -c users -o ./ && mongodump -d vertest -c testSuites -o ./"
    cp -R mongoData/vertest backup/mongo/

    # 3- clean logs and copy them from fresh
    rm -rf backup/logs/*
    cp -R logs/* backup/logs/

    # 4- same action with repositories
    rm -rf backup/repos/*
    cp -R cloneDir/* backup/repos/
}

if [ $1 == "-r" ] ; then
    restore
fi

if [ $1 == "-b" ] ; then
    backup
fi

if [ $1 == "-h" ] ; then
    echo "Script to create or restore backups
    options :
    -b to create a backup
    -r to restore the backup
    -h for help

    Be aware that in most cases, script have to be ran with root rights
    "
fi