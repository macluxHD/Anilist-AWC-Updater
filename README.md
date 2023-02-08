# Setup

Set the variables in .env.example and rename the file to .env or if you are running it in a container set the environment variables there.

## Tokens

```
ANILIST_CLIENT_ID=your_client_id
ANILIST_CLIENT_SECRET=your_client_secret
ANILIST_API_TOKEN=your_api_token
```

Create an api client at the [anilist developer page](https://anilist.co/settings/developer)
Set API Client Redirect URL to: 'pin'

rename .env.example to .env and fill in the values and then replace ```ANILIST_CLIENT_ID``` and ```ANILIST_CLIENT_SECRET``` with the corresponding values from the api client you created.

To get the access token for ```ANILIST_API_TOKEN``` go to this url and replace {your-application-id} with your application id.

```
https://anilist.co/api/v2/oauth/authorize?client_id={your-application-id}&response_type=token
```

## Configuration

```
DEBUG=false
SCHEDULE=0 0 * * *
```

run the script with npm start the comments.json file will be created in the root directory just add the links of the comments you want to update to the array in the file.

example of the array:

```
[
"https://anilist.co/forum/thread/59679/comment/2077484",
"https://anilist.co/forum/thread/61848/comment/2155941"
]
```

In the .env file you can set ```DEBUG``` to ```true``` to see the new comments in the output.

```SCHEDULE``` sets when the script should run (except for the first time) the default is every day at midnight see [this](https://crontab.guru/) to help you set the schedule. Leave it blank to run only once.

## Running

run the script with ```npm start```
