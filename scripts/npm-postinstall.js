'use strict';

const { findPython } = require('../bin/spencer.js');

if (!findPython()) {
  console.warn('[spencer] Python 3.10+ was not detected during npm install.');
  console.warn('[spencer] Install Python and set SPENCER_PYTHON if it is not on PATH.');
}
