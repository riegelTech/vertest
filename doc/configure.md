# How to configure your application ?

To configure your application, create a yaml file at ` <YOUR_APP_DIR>/config.yml` . To help you
to use correct sections and entries, you have a sample file named config-sample.yml.

## server : port

Juste an integer to specify on which port your app will listen. Default to 8080.

```yaml
server:
  port: 8080
```

## repositories

A list of GIT repositories where your tests are. Each repository have to specify a name, and an address.
You can optionally specify repository credentials, like user - password couple,
or paths to the public and private SSH keys.

```yaml
repositories:
  - name: Vertest
    address: git@github.com:riegelTech/vertest.git
    pubKey: /home/myUser/.ssh/id_rsa.pub
    privKey: /home/myUser/.ssh/id_rsa

  - name: My repository
    address: https://myRepo.git
    user: MyUser
    pass: pass
```
