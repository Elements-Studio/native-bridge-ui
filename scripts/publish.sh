#!/bin/bash

root=`pwd`

/bin/rm -rf dist dist-remote
pnpm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
  echo "Error: dist directory is empty or does not exist"
  exit 1
fi

git clone --depth 1 --branch gh-pages git@github.com:Elements-Studio/native-bridge-ui.git $root/dist-remote
cd $root/dist-remote
/bin/rm -rf *

cd $root
cp -r dist/* dist-remote/


cd $root/dist-remote

git config commit.gpgsign false
cp index.html 404.html
git add .
DEPLOY_TIME=$(date +"%Y-%m-%d %H:%M:%S")
DEPLOY_TAG=$(date +"%Y-%m-%d_%H-%M-%S")
git commit -m "Deploy to GitHub Pages - $DEPLOY_TIME"
git push --set-upstream origin gh-pages

cd $root
git tag "release/$DEPLOY_TAG"
git push origin "release/$DEPLOY_TAG"
/bin/rm -rf dist dist-remote
