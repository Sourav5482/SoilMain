# Soil Monitoring (Mobile + Backend)

Full-stack soil data collection app with:

- Mobile app: Expo React Native + BLE (ESP32)
- Backend API: Node.js + Express + MongoDB
- Image storage: Cloudinary

## Tech Stack

Mobile app:

- React Native (Expo SDK 54)
- React 19
- React Navigation (native stack)
- BLE: react-native-ble-plx
- Camera: expo-image-picker
- Location: expo-location
- HTTP: axios + fetch (multipart uploads)
- Offline queue persistence: @react-native-async-storage/async-storage
- Connectivity detection: @react-native-community/netinfo
- Local staged file storage: expo-file-system/legacy

Backend API:

- Node.js
- Express.js
- MongoDB with Mongoose
- Middleware: cors, morgan
- Upload parser: multer (memory storage)
- Environment management: dotenv

Cloud and deployment:

- Cloudinary for image hosting
- Expo EAS Build for Android APK builds
- npm for dependency management
- Nodemon + ESLint for backend development workflow

## Project Structure

```text
fianalsoil/
  backend/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
  mobile-app/
    src/
      components/
      constants/
      screens/
      services/
      utils/
```

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB instance (local or cloud)
- Cloudinary account (for image upload)
- Android Studio / Xcode (for development build)
- ESP32 device broadcasting BLE data

## 1) Backend Setup

From the project root:

```bash
cd backend
npm install
```

Create env file:

```bash
copy .env.example .env
```

Update backend/.env values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/soil_monitoring
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=soil-monitoring
CLIENT_APP_ORIGIN=*
MAX_UPLOAD_IMAGES=3
```

Run backend:

```bash
npm run dev
```

Health check:

```text
GET http://localhost:5000/health
```

## 2) Mobile App Setup

From the project root:

```bash
cd mobile-app
npm install
```

Update API URL in mobile-app/src/constants/config.js.

Example for local backend:

```js
export const API_BASE_URL = "http://<your-local-ip>:5000/api";
```

Run Expo:

```bash
npm start
```

## 3) BLE Development Build Requirement

This project uses react-native-ble-plx, which does not work in Expo Go.
Use a development build:

```bash
npx expo prebuild
npx expo run:android
```

or:

```bash
npx expo run:ios
```

Optional EAS Android build:

```bash
npx eas build -p android --profile preview --non-interactive
```

## Mobile App Flow

Data Collection screen:

- Scan and select ESP32 BLE device
- Collect 10 readings (Temp, Humidity, N, P, K)
- Capture up to 3 images
- Fill Ref ID, Location, Soil Type, Remarks
- Submit data to backend

History screen:

- Search by Ref ID
- Search by Location
- Show all Ref IDs

## API Endpoints

Base path: /api

- POST /upload-images
- POST /save-data
- GET /history/refs
- GET /history/ref/:refId
- GET /history/location/:location

## Data Model Summary

- Top-level document is unique by refId
- Each refId contains records[] entries
- Save behavior:
  - Existing refId + existing recordKey: merge into target record
  - Existing refId + new recordKey: append new record
  - New refId: create new document

## Validation and Limits

- Ref ID is required for save
- Image upload accepts 1..MAX_UPLOAD_IMAGES files per request
- MAX_UPLOAD_IMAGES defaults to 3
- Upload timeout and retry logic are handled in mobile API layer

## Useful Commands

Backend:

```bash
cd backend
npm run dev
npm start
npm run lint
```

Mobile:

```bash
cd mobile-app
npm start
npm run android
npm run ios
```
