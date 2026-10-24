# Son Meme Database

A searchable gallery of "Son 😭😭😭😭😭" meme variants. Anyone can browse and download images. Only people you give an account to can upload or delete.

## What's where

- `public/` is the website. `public/data.json` holds the 91 catalogued variants.
- `netlify/functions/` holds the server code:
  - `auth`: log in and out
  - `variants`: list, upload and delete member uploads
  - `image`: serves uploaded images
  - `download`: saves Know Your Meme images as files
- Uploaded images and their details are stored in Netlify Blobs, Netlify's built-in file storage. Nothing else to sign up for.

## Deploy (one time, about 10 minutes)

Server functions don't run on drag-and-drop deploys, so the site deploys from GitHub.

1. Create a new GitHub repository and upload everything in this folder, including the `netlify` folder, `netlify.toml` and `package.json`. Don't upload `node_modules` or `.env`; `.gitignore` already skips them.
2. In Netlify, go to **Add new project → Import an existing project → GitHub** and pick the repo. Leave the build settings blank, since `netlify.toml` covers them. Deploy.
3. In the project, go to **Project configuration → Environment variables** and add:
   - `USERS`: one or more accounts in the form `name:password`, separated by commas. Example: `gisel:pick-a-long-password,alex:another-one`
   - `SESSION_SECRET`: any long random string of 32+ characters. It signs login cookies; changing it logs everyone out.
   If Netlify asks for a scope, leave it on all scopes, or make sure it includes **Functions**.
4. Go to **Deploys → Trigger deploy** so the new variables take effect.

After that, every change you push to GitHub redeploys automatically.

## Managing accounts

- **Add or remove someone:** edit `USERS` in Netlify, then redeploy. Removing a name logs that person out right away.
- **Change a password:** edit it in `USERS` and redeploy.
- **Log everyone out:** change `SESSION_SECRET`.

## Limits

- Uploads must be PNG, JPG, GIF or WebP, 4 MB or less. The server checks the file contents, not just the extension.
- Downloads work for uploaded images and for Know Your Meme images (`i.kym-cdn.com`). Images from any other host get no download button.
- Login has a basic slowdown on wrong passwords, but no lockout. Use long passwords.
- Uploads are stored in Netlify, not in `data.json`. To make an upload part of the permanent list, copy its entry into `data.json`.
