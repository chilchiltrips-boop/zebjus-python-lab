ZEBJUS Camera Fix v2.1

Replace ONLY these two files in the GitHub repository root:
1. ai.js
2. config.js

Commit message:
Fix MediaPipe camera loading and CPU fallback

Then wait for GitHub Pages deployment and hard-refresh the site:
Mac Chrome: Cmd + Shift + R

Test:
1. Open https://chilchiltrips-boop.github.io/zebjus-python-lab/
2. Click Start Camera
3. Allow camera permission
4. Camera preview should appear immediately
5. MediaPipe hand detection loads after camera permission
