root=`pwd`

pnpm run build

cd $root/dist
git init -b gh-pages
git remote add origin git@github.com:Elements-Studio/native-bridge-ui.git
git config user.signingkey C01819ABF74FEBBB
git add .
git commit -S -m "Deploy to GitHub Pages"
git push  --force --set-upstream origin gh-pages
