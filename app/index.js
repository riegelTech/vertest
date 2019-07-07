'use strict';

const express = require('express');
const app = express();
app.use(express.json())

const testSuiteRouting = require('./testSuites/testSuite-api');

app.use('/test-suites/', testSuiteRouting);

app.listen(8080);