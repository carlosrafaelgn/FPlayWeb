@ECHO OFF

REM https://github.com/google/closure-compiler/wiki/Flags-and-Options
REM We can use --rewrite_polyfills FALSE to remove the polyfills added to the beginning of the output file

REM CALL tsc --target ES2017 --project scripts\tsconfig.json
REM java -jar D:\Tools\closure-compiler.jar --js docs\assets\js\scripts.js --js_output_file docs\assets\js\scripts.min.js --language_in ECMASCRIPT_2017 --language_out ECMASCRIPT_2017 --strict_mode_input --emit_use_strict --compilation_level SIMPLE
REM DEL docs\assets\js\scripts.js

REM CALL tsc --target ES2015 --project scripts\tsconfig.json
REM java -jar D:\Tools\closure-compiler.jar --js docs\assets\js\scripts.js --js_output_file docs\assets\js\scripts.es6.min.js --language_in ECMASCRIPT_2015 --language_out ECMASCRIPT_2015 --strict_mode_input --emit_use_strict --compilation_level SIMPLE
REM DEL docs\assets\js\scripts.js

CALL tsc --target ES2020 --project scripts\tsconfig.json
java -jar D:\Tools\closure-compiler.jar --js docs\assets\js\scripts.js --js_output_file docs\assets\js\scripts.min.js --language_in ECMASCRIPT_2020 --language_out ECMASCRIPT_2020 --strict_mode_input --emit_use_strict --compilation_level SIMPLE
DEL docs\assets\js\scripts.js
