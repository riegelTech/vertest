# Guide utilisateur de VerTest

Bienvenu dans le guide utilisateur de VerTest !

## Notions basiques

### Le principe de VerTest

VerTest est une application qui vous permet de consulter et tracker des cas de test, existant 
sous la forme de documents markdown dans un repository GIT, parmi une base de code.

Chaque suite de tests est basée sur un repository GIT cloné localement, et d'une branche GIT
correspondante. Le repository GIT est régulièrement mis à jour pour détecter les nouveaux
commits. VerTest n'écrit jamais dans le repository, et se contente des opérations de lecture.

VerTest s'appuie également sur un sélecteur de fichiers afin de faciliter la navigation entre
les plans de test, et aussi pour réduire le bruit des modifications GIT qui ne concerneraient
pas les fichiers de test.

VerTest vous permet de changer à tout moment la branche GIT choisie ou le sélecteur de fichier d'une
suite de tests.

Cela a quelques conséquences très intéressantes :

* les plans de test sont toujours synchronisés avec la base de code
* il est facile de paralléliser des campagnes de test concernant des versions différentes d'une même application
* vous et votre équipe peuvent modifier à tout moment les plans de test, VerTest vous aide à visualiser
  les modifications qui ont eu lieu et à décider si cela nécessite de changer les statuts des plans de test.
* la création d'une suite de test prend une dizaine de secondes car l'opération consiste seulement
  à cloner des fichiers préexistants dans la bonne version.

### Installation

[Comment installer VerTest ?](installation.md)

### First start of the application

[Premier démarrage de VerTest](first-start.md)

### Gestion des utilisateurs

[Gestion des utilisateurs](manage-users.md)

### Gestion des clés SSH

[Gestion des clés SSH](manage-ssh-keys.md)

## Procédures

### Créer une suite de tests

[Créer une suite de tests](create-test-suite.md)

### Les pages des suites de tests

[Les pages des suites de tests](test-suite-page.md)

### Cycle de vie d'une suite de tests

#### Consulter et valider les plans de test

[La page d'un plan de test](test-case-passing.md)

#### Gérer une modification GIT

[Gérer une modification GIT](git-modification.md)

#### Changer de branche GIT

[Changer de branche GIT](git-branch-modification.md)

#### Changer les sélecteurs de fichiers

[Changer les sélecteurs de fichiers](file-selector-modification.md)

### Templatiser les plans de test

[Templatiser les plans de test](templatize-your-tests.md)
