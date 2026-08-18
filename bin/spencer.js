#!/usr/bin/env node

'use strict';

const { main } = require('../lib/cli.js');

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(`Spencer error: ${error.message}`);
  process.exitCode = 1;
});
