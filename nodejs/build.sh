#!/bin/sh

mkdir -p scripts
mkdir -p package

echo "Building package for testing in ."
cp -r ../scripts/* scripts

echo "Building clean package for publishing in ./package"
cp -r ../scripts package/scripts
cp bluegen.js cmdparse.js package.json package
