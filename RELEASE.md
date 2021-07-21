In order to release a version the following steps need to be made:
1. Go to appveyor to see what's the last version that is there: https://ci.appveyor.com/project/IsraelHikingHost/site
2. Create a git tag with an incremented by 1 version number: `git tag v9.9.99`
3. Push the tag to make the appveyor build run: `git push origin v9.9.99`
4. If everything is finished successfully you'll have a new docker image in dockerhub, ipa file in testfilght, aab file in internal release in android and a draft release on github
5. Go to [Milestones](https://github.com/IsraelHikingMap/Site/milestones), change the "Next Release" milestone name to `Version 9.9.99` and close this milestone.
6. Create a new milestone called Next Release and move all the non-closed items from the closed milestone (Version 9.9.99 in our case).
7. Go to milestone Version 9.9.99 and click to see the closed issued. Copy the link from the addressbar - this link should be used in the stores to allow users to see which issues were closed in that release. the link should be something like: `https://github.com/IsraelHikingMap/Site/milestone/39?closed=1`
8. Go to [Releases](https://github.com/IsraelHikingMap/Site/releases) and edit the draf release with something like the following text:
The major change in this version is bla bla bla!
Other than that there are a few bug fixes.
See Milestone 9.9.76 <- this should be linked to the copied milestone above
9. Change the version of website in the docker-compose on the production server and run `make website`
10. Go to [android play console](https://play.google.com/console/u/0/developers/5619452735099300275/app/4974433974190113457/tracks/internal-testing) and promote the build to production.
11. Add text in Hebrew and English similar to the github release and click save, change the release percentage to 100% and click publish to prodcution
12. Go to the [apple appstore](https://appstoreconnect.apple.com/apps/1451300509/appstore/ios/version/deliverable) and click the plus sign in the left side to add a new version
13. Version name should be 9.9.99 in our case (no "v" or "version" there)
14. Add the same text from the android Hebrew and English versions to what's new text box
15. Scroll down and add the build v9.9.99 to that release using the green plus sign near the bottom, when there are question asked the first is yes and the others are no.
16. Once all the details are entered click save and publish
