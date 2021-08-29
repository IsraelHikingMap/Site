In order to release a version the following steps need to be made:
1. Go to appveyor to see what's the last version that is there: https://ci.appveyor.com/project/IsraelHikingHost/site/history
2. Create a git tag with an incremented by 1 version number on top of the latest Appveyor version: `git tag v9.9.99`
3. Push the tag to make the appveyor build run: `git push origin v9.9.99`
4. Check that a new build has started on Appveyor with the new tag.
5. Go to [Milestones](https://github.com/IsraelHikingMap/Site/milestones), change the "Next Release" milestone name to `Version 9.9.99` save and close.
6. Create a new milestone called "Next Release". Open the recently closed milestone and move all the non-closed items to "Next Release".
7. Go to the closed issued. Copy the link from the addressbar - this link should be used in the stores to allow users to see which issues were closed in that release. The link should be something like: `https://github.com/IsraelHikingMap/Site/milestone/39?closed=1`
8. Edit the Milestone description with a draft for the release description using the following template:

```md
The major changes in this version are:
  -
  - Various bug fixes.

See [Milestone 9.9.76](https://github.com/IsraelHikingMap/Site/milestone/39?closed=1) for the full list. <- **REPLACE WITH ACTUAL VERSION AND LINK**

השינויים המרכזיים בגרסה הם:
  - 
  - תיקוני באגים שונים.
הרשימה המלאה מופיעה בקישור https://github.com/IsraelHikingMap/Site/milestone/41?closed=1 <- **REPLACE WITH ACTUAL VERSION AND LINK**
```

#### Android
When Android build is finished successfully, go to [android play console](https://play.google.com/console/u/0/developers/5619452735099300275/app/4974433974190113457/tracks/internal-testing) 
  - "Promote release" to "Production". 
  - Copy the English release description, add an Hebrew translation, removing Markdown syntax.
  - Click the "Save" button below.
  - Click the "review release" below.
  - Change the "Roll-out percentage" to 100%.
  - Click "Start rollout to prodcution" and confirm.

#### iOS
When the iOS build is finished successfully, go to the [apple appstore](https://appstoreconnect.apple.com/apps/1451300509/appstore/ios/version/deliverable) 
  - If neede, get verification code from Harel and then choose the "IsraelHiking Map" app
  - Click the plus sign in the left side 
  - Add a new version, such as "9.9.99" <- **No "v" or "version" there**
  - Fill the "What's New in This Version" from the Android release in both Hebrew and English
  - Click on the "Build +" button below and add the appropriate build to the release.
    - Respond "Yes" to the first "Export Compliance Information" question and "No" to the follow-up questions.
  - Click "Save" and then "Submit for Review" at the top of the page.

#### Github and Docker
When the docker and tests are finished successfully.
  - Go to [Releases](https://github.com/IsraelHikingMap/Site/releases).
  - Click "Edit" next to the new "Draft" version.
  - Fill the "Describe this release" from the Milestone draft description and check with "Preview".
  - Click "Publish release" below.
  - Login to the site server.
    - Modify the website version in the `docker-compose.yml` file.
    - Run `make pull-dockerhub website`.
    - Open the website in incognito mode or with cache disabled.
    - Run `git commit -e -a`.
    - Run `git push`.
