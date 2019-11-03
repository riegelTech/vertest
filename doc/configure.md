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

## repositories

A list of GIT repositories where your tests are. Each repository have to specify a name, and an address.
You can optionally specify repository credentials, like user - password couple,
or paths to the public and private SSH keys.

You can set test file search patterns for each repository. Patterns can be string or arrays of strings.
Patterns are based on glob syntax : [glob syntax](https://facelessuser.github.io/wcmatch/glob/). But I can't
guarantee full blog support.

```yaml
repositories:
  - name: Vertest
    address: git@github.com:riegelTech/vertest.git
    pubKey: /home/myUser/.ssh/id_rsa.pub
    privKey: /home/myUser/.ssh/id_rsa
    testDirs: **/*-test.md

  - name: My repository
    address: https://myRepo.git
    user: MyUser
    pass: pass
    testDirs:
      - manual-test-plans/*.md
      - other-test-plans/**/*.md
```

<p class="warning">
If your SSH private key is encrypted, you will see a red lock symbol in repositories grid.
So you can enter its passphrase clicking on this symbol.
</p>