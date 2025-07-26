# FlavorWorldFinalProject
*change ip adress in the services
*add file .env:
PORT=3000
MONGODB_URI=yourmongoDB
EMAIL_USER=yourapp@gmail.com
EMAIL_PASS=your-app-password
JWT_SECRET=your-secret-key-for-jwt

Server:
cd server
npm install socket.io express mongoose cors multer dotenv nodemailer
node index.js

Client (main directory of the project):
npm install socket.io-client expo-modules-core expo-document-picker nodemailer
npx expo start -c
