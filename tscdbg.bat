@ECHO OFF

CALL tsc --project scripts\tsconfig.json

node bundle.js

MOVE temp\scripts.js docs\assets\js\scripts.min.js
