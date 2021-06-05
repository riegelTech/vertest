#! /bin/bash

#****************************************************
# online demo site needs to be regularly cleaned    *
# this file will rollback all data contained into   *
# backup dir                                        *
#****************************************************

# 1- get the id of the running mongo container
CONTAINER_NAME=$(docker-compose ps | grep mongod | grep -Eo "^([A-Za-z0-9_-]*)")

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
