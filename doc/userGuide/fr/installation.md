# Comment installer VerTest ?

## Configuration

Pour configurer VerTest, il faut tout d'abord créer un fichier Yaml à l'emplacement
` <YOUR_APP_DIR>/config.yml` . Afin de faciliter la configuration et réduire le risque
d'erreurs, vous trouverez un fichier `config-sample.yml`, son contenu correspond à une 
configuration par défaut.

Notez qu'en cas d'absence du fichier `config.yml`, l'application utilisera le fichier 
`config-sample.yml`.

> Veuillez vous reporter à la section correspondante 
> [documentation détaillée de la configuration](configuration.md) avant de continuer.

## Installation

Pour lancer VerTest, vous aurez besoin de docker [docker](https://docs.docker.com/engine/install/) et de
[docker-compose](https://docs.docker.com/compose/install/) installés sur votre machine.

Ensuite clonez VerTest, ou désarchivez le package.
```bash
$ git clone https://github.com/riegelTech/vertest.git
$ cd vertest
```

Installez les modules npm :

```bash
$ npm install
```

Buildez la partie front-end de l' application :

```bash
$ npm run build
```

Ensuite nettoyez les modules npm non nécessaires à l'application en mode production :

```bash
$ npm prune --production
```

Ensuite lancez simplement l'appliaction à l'aide de docker-compose
```bash
$ docker-compose up
```

## Maintenance

### Sauvegarde

Il n'existe pas de script de sauvegarde officiel, même si un script bash `rollbak_demo.sh` se trouve à la
racine du projet. Il sert uniquement à automatiser les procédures de rollback du serveur de démo.

La seule chose à savoir c'est que les données sont stockées à trois endroits :

1. MongoDB
2. le répertoire `repositoriesDir` (voir la [documentation sur la configuration](configuration.md))
3. le répertoire des logs (voir la [documentation sur la configuration](configuration.md))

Pour réaliser un instantané des repositories et des logs, vous pouvez créer une archive qui contient
une copie des répertoires correspondants.

Pour faire un instantané de la base MongoDB, vous devrez exécuter ces commandes dans le container
Docker appelé `mongo`.

1. assurez-vous que le container est démarré, sinon tapez : `$ docker-compose up mongo`
2. récupérez le nom du container `$ docker-compose ps | grep mongod | grep -Eo "^([A-Za-z0-9_-]*)"`
3. exécutez la commande de dump `$ docker exec "[NOM_DE_VOTRE_CONTAINER]" bash -c "cd /data/db/ && mongodump -d vertest -c users -o ./ && mongodump -d vertest -c testSuites -o ./ && mongodump -d vertest -c metadata -o ./"`
4. dans le répertoire `mongoData` il y existe maintenant un nouveau répertoire `vertest` qui contient l'instantané

> Notez que cette opération requiert probablement les droits super utilisateur

### Restauration

Pour restaurer les logs et les repository GIT, remplacez simplement les répertoires par leur équivalent
en sauvegarde.

Pour restaurer la base de données, vous devrez exécuter les commandes MongoDB suivantes dans le container
Docker appelé `mongo`.

1. copiez le dossier d'instantané de la base `vertest` dans le dossier `mongoData`
2. assurez-vous que le container est démarré, sinon tapez : `$ docker-compose up mongo`
3. récupérez le nom du container `$ docker-compose ps | grep mongod | grep -Eo "^([A-Za-z0-9_-]*)"`
4. exécutez la commande de restauration `docker exec "[YOUR_CONTAINER_NAME]" bash -c "cd /data/db/ && mongorestore -d vertest -c testSuites --drop vertest/testSuites.bson && mongorestore -d vertest -c users --drop vertest/users.bson && mongorestore -d vertest -c metadata --drop vertest/metadata.bson"`
5. enfin stoppez le container et redémarrez-le `docker-compose down && docker-compose up`

> Notez que cette opération requiert probablement les droits super utilisateur
