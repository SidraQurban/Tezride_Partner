@echo off
echo ===================================================
echo Automated Android Tools AND Java Setup
echo ===================================================

set ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
set CMDLINE_TOOLS_URL=https://dl.google.com/android/repository/commandlinetools-win-11479570_latest.zip
set JDK_URL=https://download.java.net/java/GA/jdk17.0.2/dfd4a8d0985749f896bed50d7138ee7f/8/GPL/openjdk-17.0.2_windows-x64_bin.zip

mkdir "%ANDROID_HOME%" 2>nul
cd /d "%ANDROID_HOME%"

echo [1/6] Checking for Java...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo Java not found! Downloading OpenJDK 17...
    if not exist "%ANDROID_HOME%\jdk\bin\java.exe" (
        curl -L -o jdk.zip %JDK_URL%
        tar -xf jdk.zip
        rename jdk-17.0.2 jdk
        del jdk.zip
    )
    set "JAVA_HOME=%ANDROID_HOME%\jdk"
    set "PATH=%ANDROID_HOME%\jdk\bin;%PATH%"
) else (
    echo Java is installed.
)

echo [2/6] Checking Android Command Line Tools...
if not exist "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" (
    echo Downloading Command Line Tools...
    curl -L -o cmdline-tools.zip %CMDLINE_TOOLS_URL%
    mkdir cmdline-tools 2>nul
    tar -xf cmdline-tools.zip -C cmdline-tools
    del cmdline-tools.zip
    rename "cmdline-tools\cmdline-tools" "latest" 2>nul
)

echo [3/6] Expanding PATH for current session...
set "PATH=%PATH%;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator"

echo [4/6] Installing SDK components (Accepting licenses)...
echo y| call sdkmanager --licenses >nul
call sdkmanager "platform-tools" "platforms;android-34" "system-images;android-34;google_apis_playstore;x86_64" "emulator"

echo [5/6] Creating Android Virtual Device (AVD)...
echo no| call avdmanager create avd -n ExpoEmulator -k "system-images;android-34;google_apis_playstore;x86_64" --force

echo [6/6] Starting the Emulator...
start /B emulator -avd ExpoEmulator -no-snapshot-save

echo Waiting 20 seconds for emulator to connect...
timeout /t 20

echo ===================================================
cd /d "C:\Users\HP\Downloads\Bykea_Clone"
echo Starting Expo to connect to the emulator!
echo ===================================================
call npx expo start --android

pause
