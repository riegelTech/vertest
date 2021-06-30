# Comment configurer VerTest ?

Pour configurer votre application, créez un fichier yaml dans ` <YOUR_APP_DIR>/config.yml` . Vous pouvez
vous aider du fichier `config-sample.yml` pour reproduire les sections et clés de configuration.

Si le fichier `config.yml` est absent, l'application utilisera `config-sample.yml` à la place.

> Note : Tout changement dans ces fichiers nécessite le redémarrage de l'application.

## server

Ici se trouvent la configuration globale de l'application.

```yaml
server:
  port: 8080
  sessionExpiration: 180 # delay after which session will end anyway (in minutes)
  sessionInactivityExpiration: 10 # delay of inactivity after which session will end (in minutes)
```

`port` : un entier qui indique sur quel port le serveur de l'application écoutera. Par défaut 8080.
`sessionExpiration` : la durée (en minutes) maximale d'une session, 180 minutes par defaut
`sessionInactivityExpiration` : la durée (en minutes) maximale d'inactivité d'une session, 10 minutes par defaut

## sshKeys

Pour accéder à un repository GIT privé, vous aurez certainement besoin de fichiers de clés SSH.
Ce sont des fichiers contenant des secrets, c'est pourquoi ils ne sont pas gérés par l'application, c'est
pourquoi vous devez les référencer en indiquant à VerTest où les trouver sur le système de fichier.
Quand l'application démarre, les clés SSH protégées par mot de passe doivent être déchiffrée 
préalablement à leur utilisation. Les mots de passe ne sont PAS stockés par VerTest.

```yaml
sshKeys:
  - name: "some ssh key"
    pubKey: /home/myUser/.ssh/id_rsa.pub
    privKey: /home/myUser/.ssh/id_rsa

  - name: "some other ssh key"
    pubKey: /home/myOtherUser/.ssh/id_rsa.pub
    privKey: /home/myOtherUser/.ssh/id_rsa
```

`name` : une chaine de caractères représentant le nom de la clé SSH. C'est ce nom qui sera affiché aux utilisateurs.
`pubKey` : le chemin vers le fichier de clé SSH publique sur le système de fichiers
`privKey` : le chemin vers le fichier de clé SSH privée sur le système de fichiers

> :warning:
> Si la clé privée est protégée, un symbole de cadenas rouge apparaîtra sur la ligne de la clé
> dans l'écran des clés SSH. Il vous suffit de cliquer sur ce symbole pour entrer le mot de passe
> de déchiffrage.

## workspace

Chaque suite de tests est liée à un reposiroty GIT complet, potentiellement important, c'est pourquoi
vous pouvez choisir dans quel endroit du disque vous voulez stocker ces repositories.
Vous pouvez faire de même concernant les logs.

```yaml
workspace:
  repositoriesDir: ./cloneDir # can be also absolute
  temporaryRepositoriesDir: ./tempDir # can be also absolute
  logsDir: ./logs # can be also absolute
  xssConfigFile: ./config/xss-white-list-sample.json # can be also absolute
```

`repositoriesDir` : l'endroit du système de fichier où vous souhaitez stocker les repository GIT, par défaut `./cloneDir`
`temporaryRepositoriesDir` : l'endroit du système de fichier où vous souhaitez stocker les repositories temporaires, par défaut `./tempDir`
`logsDir` : l'endroit du système de fichier où vous souhaitez stocker les logs
`xssConfigFile` : l'endroit du système de fichier où se trouve le fichier de configuration des protections XSS (voir note ci-dessous)

> Note : selon le poids de vos repository GIT, ils peuvent consommer beaucoup de mémoire, veillez à
> choisir le chemin des repositories en tenant compte de cette contrainte.

> Note : VerTest apporte une protection contre les attaques XSS par une liste blanche de tags et
> attributs HTML autorisés en sortie de rendu markdown.
> Vous pouvez modifier cette liste en modifiant le fichier xss-white-list-sample.json et en le référençant dans la configuration.

## testCaseStatuses

Il est possible de configurer ses propres statuts de test.

```yaml
testCaseStatuses:
  defaultStatus: todo # The default status of a test case
  todo: # The test case isn't affected
    done: false # with this status; the test is considered as finished
    color: "#b0bec5" # The status color to display on charts (pay attention to the double quotes around the value)
    lang: # The localized signification of the status, the name will be used if not lang is not defined
      en: To do
      fr: A faire
    meaning:
      en: "The test isn't affected to a user"
      fr: "Le test n'est pas affecté à un utilisateur"
```

`defaultStatus` : le nom du statut affecté par défaut à un nouveau plan de test
`todo` : le nom technique du statut, affiché comme nom de statut si `lang` est manquant
`done` : booléen indiquant si le plan de test portant ce statut doit être considéré comme terminé. Ceci va influer sur la visualisation de la progression des suites de test.
`color` : valeur hexadécimale de la couleur du statut (attention, ces valeurs doivent être entourées de double quotes)
`lang` : objet contenant toutes les traductions du nom du statut
`meaning`: objet contenant pour chaque langue une courte explication de la signification du statut, afin d'aider les utilisateurs.

> Note : le `defaultStatus` doit obligatoirement exister parmi les noms de statuts. Si ce n'est pas le cas,
> la configuration des statuts échouera silencieusement et les statuts par défaut seront utilisés.
> Si vous constatez un écart entre votre configuration et l'affichage effectif des statuts, n'hésitez
> pas à ouvrir le fichier de log d'erreurs.

> Note : comme le format Yaml utilise le caractère hash `#` pour indiquer un commentaire, n'oubliez pas
> d'entourer les valeurs de couleur avec des guillemets.

> Note : si vous supprimez un statut qui est affecté à un plan test, au redémarrage de l'application vous
> devrez indiquer l'équivalence entre l'ancien statut et le nouveau.
