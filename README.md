# VerTest

## Why ?

Most of the test tracking solutions store tests content into distant database.
When team works on multiple parallels versions of the project, the tests should follow code versions.
The simplest way to do that is to store the tests with code : it allows to work on different test
versions simultaneously.

This application provides a solution to create tests suites and fill them with tests cases imported
from a GIT repository. Then you can affect them to team members and track tests results.

## Documentation

Find the complete documentation here : [./doc/home.md](./doc/home.md)

## Demo

You can find a demo [here](https://vertest.riegel.tech), access it with login "admin" and password "adminadmin".
Don't worry about the modification you make, even potentially destructive, all the application is restored
 back every night.

Note that a user named "Ares" is read-only (if it has not been modified by another demo player), login with
 "ares" login and "adminadmin" password.
