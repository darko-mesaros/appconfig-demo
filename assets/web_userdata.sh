#!/bin/bash

sudo yum -y update
# Install nvm: 
sudo yum install -y gcc-c++ make
curl -sL https://rpm.nodesource.com/setup_12.x | sudo -E bash -
sudo yum -y install nodejs
npm install -g pm2