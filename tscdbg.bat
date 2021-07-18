@ECHO OFF

CALL tsc --project scripts\tsconfig.json

MOVE docs\assets\js\scripts.js docs\assets\js\scripts.min.js
