#!/bin/bash

root=`pwd`

pnpm run build

cd $root/dist
cp index.html 404.html
git init -b gh-pages
git remote add origin git@github.com:Elements-Studio/native-bridge-ui.git
git config commit.gpgsign false
git add .
git stash
git pull origin gh-pages || true
git stash pop || true
git commit -m "Deploy to GitHub Pages"
git push  --force --set-upstream origin gh-pages
