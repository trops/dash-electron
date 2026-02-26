# Change the name of the package if the package name = "dash-electron"

# Check Node.js version compatibility
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ ERROR: Node.js version $NODE_VERSION is too old."
    echo "   This project requires Node.js v18, v20, or v22 (LTS versions)."
    echo ""
    if command -v nvm &> /dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo "   You have nvm installed. Run these commands:"
        echo "   source \$HOME/.nvm/nvm.sh"
        echo "   nvm install 20"
        echo "   nvm use 20"
    else
        echo "   Install nvm and Node.js v20:"
        echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
        echo "   source ~/.zshrc"
        echo "   nvm install 20"
    fi
    exit 1
elif [ "$NODE_VERSION" -ge 24 ]; then
    echo "❌ ERROR: Node.js v$NODE_VERSION is too new and has breaking changes."
    echo "   This project requires Node.js v18, v20, or v22 (LTS versions)."
    echo ""
    if command -v nvm &> /dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo "   You have nvm installed. Run these commands:"
        echo "   source \$HOME/.nvm/nvm.sh"
        echo "   nvm install 20"
        echo "   nvm use 20"
        echo "   nvm alias default 20"
    else
        echo "   Please downgrade to Node.js v20 (LTS)."
        echo "   Consider using nvm for easier Node.js version management:"
        echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    fi
    exit 1
elif [ "$NODE_VERSION" -eq 23 ]; then
    echo "⚠️  WARNING: Node.js v23 may have compatibility issues."
    echo "   Recommended versions: v18, v20, or v22 (LTS)."
    echo "   Continuing anyway..."
else
    echo "✓ Node.js version v$(node -v) is compatible."
fi

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