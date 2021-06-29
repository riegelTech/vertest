# SSH keys

![keys on desk](../assets/keys-deck.jpg)

## Abstract

Test the ssh keys page, lock and unlock actions.

## Prerequisites

1. Copy the directory [./prerequisites/ssh-keys/](../prerequisites/ssh-keys/) on the project's root directory with its content
2. Configure two ssh keys on the config file [../../../config.yml](../../../config.yml) as explained on [official documentation](../../../doc/configure.md).
   So just replace the section "sshKeys" with the content below:
    ```
    sshKeys:
      - name: "unprotected key"
        pubKey: ./ssh-keys/unprotectedClientSshKey.pub
        privKey: ./ssh-keys/unprotectedClientSshKey
    
      - name: "protected key"
        pubKey: ./ssh-keys/protectedClientSshKey.pub
        privKey: ./ssh-keys/protectedClientSshKey
    ```
3. Start app

## Test

### First display

1. Login
2. Go to http://[serverName]/#/ssh-keys
3. You should see two entries: "unprotected key" and "protected key"
4. "unprotected key" should appear with an icon of an open locker
5. "protected key" should appear with an icon of a locked locker

### Unlocking ssh key

1. Click on the locker of the "protected key"
2. A popin should appear
3. Enter a wrong password "wrong" in the password field, and send
4. An explicit error message should appear
5. Enter "foobar" in the password field and validate
6. The key should now appear as unlocked

### Persistence

1. Restart app
2. Login again
3. The protected ssh key should be reset at its initial state: locked

### Logs

1. Open the log info file in the project's log directory
2. The unlock action should be properly logged
