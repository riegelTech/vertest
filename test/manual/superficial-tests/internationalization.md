# Internationalization

![Dictionary](../assets/dictionary.jpg)

## Abstract

Test the internationalization of the application, and the language change.

## Prerequisites

1. App is running
2. You are logged in

!!!include(../common-parts/login.md)!!!

## test

### Login page

1. Logout
2. Under the login form you should see as many country flags as supported languages
3. You can change the current language by clicking on them
4. Log in
5. The country flags are on the top-left corner of the screen
6. You can switch the application languages by clicking on them

### Home page

1. Browse at http://[serverName]/#/en/
2. Home page should be in english
3. Browse at http://[serverName]/#/fr/ (the browser should not have reloaded the page)
4. Home page should be in french

### Test suite page

1. Browse at http://[serverName]/#/en/
2. Click on a test suite
3. Change the language on the url
4. The page should be in french