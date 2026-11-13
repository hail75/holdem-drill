# Turning on Google sign-in and sync

The app can save progress to a Google account, so the same progress shows on a phone and a computer. It uses Firebase (Google's free app backend). Until a Firebase project is connected, the Account section in Settings says sync is not set up, and the app saves on the device only.

Setting it up takes about ten minutes and is done once, by the owner of the site.

## 1. Create the project

1. Go to https://console.firebase.google.com and choose **Add project**. Any name works. Google Analytics is not needed.
2. In the project, choose **Add app**, then the web icon (`</>`). Give it a nickname. Do not tick Firebase Hosting.
3. Firebase shows a `firebaseConfig` block. Keep that page open: step 4 needs it.

## 2. Turn on Google sign-in

1. **Build > Authentication > Get started**.
2. **Sign-in method > Google > Enable**, pick a support email, **Save**.
3. **Authentication > Settings > Authorized domains > Add domain**: add the domain the app is served from, for example `hail75.github.io`.

## 3. Create the database and lock it down

1. **Build > Firestore Database > Create database**. Choose a location near you and start in **production mode**.
2. Open the **Rules** tab, replace the rules with these, and **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Each person can read and write only their own document.

## 4. Put the config in the app

In `index.html`, find `var FIREBASE=null;` and replace `null` with the values from step 1:

```js
var FIREBASE={apiKey:"...",authDomain:"your-project.firebaseapp.com",projectId:"your-project",appId:"..."};
```

These values are not secret: they only say which project to talk to, and the rules above protect the data. Then release as usual (bump the version in `index.html` and `sw.js`).

## How sync behaves

- The copy on the device is always the working copy, so the app works with no connection.
- First sign-in on a device: if the account is empty, the device's progress is uploaded. If the account already has at least as many answered spots, the account's copy replaces the device's.
- After that, the later change wins. Changes made offline are uploaded when the connection returns.
- Signing out leaves the device's copy in place.
