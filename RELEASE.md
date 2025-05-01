## How to release a new version to production

Go to Github actions at https://github.com/IsraelHikingMap/Site/actions and manually run build and publish with all options set to true

### Server

When the docker build is finished successfully, go to the server's repo and update the .env file with the newly released version either by PR or by directly pushing to main
