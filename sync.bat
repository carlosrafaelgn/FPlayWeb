@ECHO OFF

DEL /S /Q "Android\app\src\main\assets\*.*"

RMDIR /S /Q "Android\app\src\main\assets\assets"
MKDIR "Android\app\src\main\assets\assets"
XCOPY "docs\assets" "Android\app\src\main\assets\assets" /E

DEL /S /Q "Android\app\src\main\assets\assets\images\favicons\*.*"
RMDIR /S /Q "Android\app\src\main\assets\assets\images\favicons"

DEL /S /Q "Android\app\src\main\assets\assets\js\scripts.es6.min.js"

COPY "docs\index.html" "Android\app\src\main\assets\index.html"
