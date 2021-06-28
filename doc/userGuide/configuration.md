# How to configure your application ?

To configure your application, create a yaml file at ` <YOUR_APP_DIR>/config.yml` . To help you
to use correct sections and entries, you have a sample file named `config-sample.yml`.

Note that if no `config.yml` file is found, application will use `config-sample.yml` file instead.

> Note: all changes that you make in this file requires a restart to apply.

## server

Here are some global configuration values for the server.

```yaml
server:
  port: 8080
  sessionExpiration: 180 # delay after which session will end anyway (in minutes)
  sessionInactivityExpiration: 10 # delay of inactivity after which session will end (in minutes)
```

`port`: it is just an integer to specify on which port your app will listen. Default to 8080.
`sessionExpiration`: the delay (in minutes) after which the session will expires in any cases, set to 180 mn by default
`sessionInactivityExpiration`: the delay (in minutes) of inactivity before the session ends, set to 10 minutes by default

## sshKeys

To access to private repositories, you may need SSH keyring files. These are considered as secrets, and not managed
by application. So you have to setup the path where they are stored. At application start, encrypted private SSH keys
have to be decrypted with passphrase that will NOT be stored.

```yaml
sshKeys:
  - name: "some ssh key"
    pubKey: /home/myUser/.ssh/id_rsa.pub
    privKey: /home/myUser/.ssh/id_rsa

  - name: "some other ssh key"
    pubKey: /home/myOtherUser/.ssh/id_rsa.pub
    privKey: /home/myOtherUser/.ssh/id_rsa
```

`name`: a string representing the name of the SSH key. This name will be displayed to front-end users.
`pubKey`: the path to the public key file in your system
`privKey`: the path to the private key file in your system

> :warning:
> If your SSH private key is encrypted, you will see a red lock symbol in repositories grid.
> So you can enter its passphrase clicking on this symbol.

## workspace

Each test suite is linked to a full GIT repository, potentially very large, so you can choose where application will
store the GIT repositories in disk.
In addition, you can choose the logs directory.

```yaml
workspace:
  repositoriesDir: ./cloneDir # can be also absolute
  temporaryRepositoriesDir: ./tempDir # can be also absolute
  logsDir: ./logs # can be also absolute
  xssConfigFile: ./config/xss-white-list-sample.json # can be also absolute
```

`repositoriesDir`: the path of a directory on your system that will contain all the cloned repositories, default to `./cloneDir`
`temporaryRepositoriesDir`: the path of a directory on your system that will contain all the temporary cloned repositories, default to `./tempDir`
`logsDir`: the path of a directory on your system that will contain all the logs
`xssConfigFile`: the path to the configuration file of XSS protection (see note below)

> Note: depending of the weight of your repositories, and the number of them, the `repositoriesDir`
> can consume much memory, take that into account when you choose the directory.

> Note: VerTest gives a protection against XSS attack with a default HTML tags and attributes
> whitelist that the markdown render can output.
> You can modify the filter editing the xss-white-list-sample.json and linking it in the configuration file

## testCaseStatuses

You can configure your own statuses for the test cases.

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

`defaultStatus`: the name of the default status, i.e. the status affected to a new test case
`todo`: the internal name of the status, and displayed name if `lang` is missing
`done`: boolean value that indicates if a test case with this status should be considered as finished, to report the true progression of the related test suite
`color`: hex value of the color of the status (pay attention to the doubles quotes)
`lang`: contains every translated name for the status
`meaning`: contains a sentence that will help the users to understand the exact meaning of the status, so it is localized

> Note: the `defaultStatus` should be an existing status name, if it does'nt, the configuration will silently
> fail, and the default statuses will be loaded, keep an eye to the error log if the statuses you see are unexpected.

> Note: as Yaml format uses the `#` character for the comments, do not forget to wrap the colors
> values with double quotes `"`

> Note: if you delete a status that currently applies on test cases, the front-end application will ask
> you to choose the replacing statuses to apply on these test cases.
