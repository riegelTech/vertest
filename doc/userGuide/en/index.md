# VerTest user guide

Welcome into the VerTest user guide !

## Basics

### The philosophy of VerTest

VerTest is an application that allows you read and track tests that are in the form
of markdown documents, standing in a GIT repository among code files.

Each test suite is based on a repository that is locally cloned, and a chosen GIT branch. Then the GIT repo
will be regularly pulled it to detect new commits, VerTest does not perform write operation at all.

VerTest add also a file selector, to ease the file navigation, and to reduce the noise of GIT repo
modifications when they does not concern the test files.

VerTest allows you to change the GIT branch or the file selector at any time.

Cool consequences are multiples:

* the tests are always synchronized with the code base
* you can easily parallelize the tests between multiple GIT branches on the same application
* you and your team can edit the tests at any time, VerTest will help you to visualize the 
  differences and to change subsequent tests statuses.
* creating a test suite takes around 10 seconds because it simply duplicates existing documents
  in the desired version

### Installation 

[How to install and configure Vertest ?](installation.md)

### First start of the application

[First start of VerTest](first-start.md)

### Manage users

[Manage the users](manage-users.md)

### Manage SSH keys

[Manage SSH keys](manage-ssh-keys.md)

## Howto

### Create a test suite

[Create a test suite](create-test-suite.md)

### Test suite page

[Test suite page](test-suite-page.md)

### Test suite lifecycle

#### Read and pass the test cases

[Test case page](test-case-passing.md)

#### Handle a GIT modification

[Handle a GIT modification](git-modification.md)

#### Changing the GIT branch

[Change the git branch](git-branch-modification.md)

#### Changing the file selector

[Change the file selector](file-selector-modification.md)

### Templatize your tests

[Templatize your tests](templatize-your-tests.md)
