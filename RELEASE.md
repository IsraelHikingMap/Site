In order to release a version the following steps are needed:
1. Go to Github actions at https://github.com/IsraelHikingMap/Site/actions and manually run build and publish with both options set to true
2. Go to [Milestones](https://github.com/IsraelHikingMap/Site/milestones), change the "Next Release" milestone name to `Version 9.9.99` save and close.
3. Create a new milestone called "Next Release". Open the recently closed milestone and move all the non-closed items to "Next Release".
4. Go to the closed issued. Copy the link from the addressbar - this link should be used in the stores to allow users to see which issues were closed in that release. The link should be something like: `https://github.com/IsraelHikingMap/Site/milestone/39?closed=1`
5. Edit the Milestone description with a draft for the release description using the following template:

```md
The major changes in this version are:
  -
  - Various bug fixes

The full list can be found at https://github.com/IsraelHikingMap/Site/milestone/66?closed=1

השינויים המרכזיים בגרסה הם:
  - 
  - תיקוני באגים שונים
הרשימה המלאה מופיעה בקישור https://github.com/IsraelHikingMap/Site/milestone/66?closed=1
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
  - Click "Save" and then "Submit for Review" at the top of the page.

#### Github
When the build is finished successfully.
  - Go to [Releases](https://github.com/IsraelHikingMap/Site/releases).
  - Click "Edit" next to the new "Draft" version.
  - Fill the "Describe this release" from the Milestone draft description and check with "Preview".
  - Click "Publish release" below.

#### Server
When the docker build is finished successfully, go to the server's repo and update the .env file with the newly released version either by PR or by directly pushing to main
