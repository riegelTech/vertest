# How to configure your application ?

To configure your application, create a yaml file at ` <YOUR_APP_DIR>/config.yml` . To help you
to use correct sections and entries, you have a sample file named `config-sample.yml`.

Note that if no `config.yml` file is found, application will use `config-sample.yml` file instead.

## server : port

Juste an integer to specify on which port your app will listen. Default to 8080.

```yaml
server:
  port: 8080
```

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

> Note: Vertest gives a protection against XSS attack with a default HTML tags and attributes
> whitelist that the markdown render can output.
> You can modify the filter editing the xss-white-list-sample.json and linking it in the configuration file
