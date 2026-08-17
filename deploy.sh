#!/bin/bash

echo "Pulling latest code..."
git pull origin feature/multi-association

echo "Updating backend..."
cd backend
npm install
npx prisma generate
npx prisma db push

echo "Restart backend..."
pkill node
node server.js &

echo "Updating frontend..."
cd ../frontend
npm install

echo "Build APK..."
npx eas build -p android --profile apk

echo "Deployment finished."
