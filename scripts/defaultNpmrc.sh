# Change the name of the package if the package name = "dash-electron"

# creates an .npmrc file with registry config
if [[ -e "./.npmrc" ]]; then
    echo ".npmrc exists; proceeding to next step"
    rm -rf ./.npmrc
    touch ./.npmrc
    echo "legacy-peer-deps=true" >> ./.npmrc
   else
    echo "Creating .npmrc file"
    touch ./.npmrc
    echo "legacy-peer-deps=true" >> ./.npmrc
fi

# lets check and make sure there is a ./Widgets directory

if [ -d ./src/Widgets ]; then
  echo "Directory exists."
  else
  mkdir ./src/Widgets
  touch ./src/Widgets/index.js
  # lets now create the first Widget
  node ./scripts/widgetize.js MyFirstWidget
  echo "Directory does NOT exist"
fi