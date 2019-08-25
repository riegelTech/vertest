# VerTest

## Why ?

Most of the test tracking solutions store tests content into distant database.
When team works on multiple parallels versions of the project, the tests should follow code versions.
The simplest way to do that is to store the tests with code : it allows to work on different test
versions simultaneously.

This application provides a solution to create tests suites and fill them with tests cases imported
from a GIT repository. Then you can affect them to team members and track tests results.

## How it works ?

1. create a test suite with a POST request on `/test-suites/`
2. fill the test suite with a PU request on `test-suites/import-test-cases/:uuid`, giving
   the GIT repository URL, the GIT branch and the root directory where your tests stands.