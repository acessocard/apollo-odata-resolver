#!/bin/sh

setup_git() {
  git config --global user.email "tarvis-ci@meuacesso.com.br"
  git config --global user.name "acesso"
  git config --global push.default matching
  git config credential.helper "store --file=.git/credentials"
  echo "https://${GH_TOKEN}:@github.com" >.git/credentials
}

make_version() {
  git checkout -- .
  git status
  yarn version --patch
}

upload_files() {
  git push origin HEAD:$TRAVIS_BRANCH
  git push --tags
}

if [ "$TRAVIS_PULL_REQUEST" != "false" ]; then
  setup_git
  make_version
  upload_files
fi
