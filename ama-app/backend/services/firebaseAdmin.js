const admin = require('firebase-admin');
const path = require('path');

let db = null;
let auth = null;

try {
  const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  auth = admin.auth();
  console.log('✅ Firebase Admin connected successfully.');
} catch (err) {
  console.warn('⚠️ Firebase Admin failed to initialize. Using mocks or memory where applicable.', err.message);
}

module.exports = { admin, db, auth };
