#!/bin/sh

setup_git() {
  git config --global user.email "alisonmsn@hotmail.com"
  git config --global user.name "slipalison"
}

# commit_website_files() {
#   git checkout -b gh-pages
#   git add . *.html
#   git commit --message "Travis build: $TRAVIS_BUILD_NUMBER"
# }

upload_tags() {
  git remote add origin https://${GH_TOKEN}@github.com/slipalison/apollo-odata-resolver.git > /dev/null 2>&1
  git push --tags
}

setup_git
# commit_website_files
upload_tags