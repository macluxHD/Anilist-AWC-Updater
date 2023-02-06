# Setup

## Tokens

Replace the values in .env.example with your own values and rename the file to .env

```
ANILIST_CLIENT_ID=your_client_id
ANILIST_CLIENT_SECRET=your_client_secret
ANILIST_API_TOKEN=your_api_token
```

Create an api client at the [anilist developer page](https://anilist.co/settings/developer)
Set API Client Redirect URL to: 'pin'

rename .env.example to .env and fill in the values and then replace ANILIST_CLIENT_ID and ANILIST_CLIENT_SECRET with the corresponding values from the api client you created

To get the access token for ANILIST_API_TOKEN go to this url and replace {your-application-id} with your application id

```
https://anilist.co/api/v2/oauth/authorize?client_id={your-application-id}&response_type=token
```

## Configuration

run the script with npm start the comments.json file will be created in the root directory just add the links of the comments you want to update to the array in the file

example of the array:

```
[
"https://anilist.co/forum/thread/59679/comment/2077484",
"https://anilist.co/forum/thread/61848/comment/2155941"
]
```

## Running

run the script with ```npm start```
