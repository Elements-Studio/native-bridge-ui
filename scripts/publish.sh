#!/bin/bash

root=`pwd`

/bin/rm -rf dist dist-remote
pnpm run build


git clone --depth 1 --branch gh-pages git@github.com:Elements-Studio/native-bridge-ui.git $root/dist-remote
cd $root/dist-remote
/bin/rm -rf * 

cd $root
cp -r dist/* dist-remote/


cd $root/dist-remote

git config commit.gpgsign false
cp index.html 404.html
git add .
git commit -m "Deploy to GitHub Pages - $(date +"%Y-%m-%d %H:%M:%S")"
git push --set-upstream origin gh-pages

cd $root
/bin/rm -rf dist dist-remote
