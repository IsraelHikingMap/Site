## How to release a new version to production

Update the following files and commit:
- IsraelHiking.Web/ios/App/fastlane/metadata/en-US/release_notes.txt
- IsraelHiking.Web/android/fastlane/metadata/android/en-US/changelogs/default.txt

Go to Github actions at https://github.com/IsraelHikingMap/Site/actions and manually run build and publish with all options set to true

### Server

When the docker build is finished successfully, go to the server's repo and update the .env file with the newly released version either by PR or by directly pushing to main
