# Notes

This script can be used with the official [seasonal challenge code](https://docs.google.com/document/d/1hE-R6Nz0n5BaXiwuHLTHv6xeYOjAdIH7lMHhemCqsDc) or any other of their codes like for the monthly challenges. It also supports custom codes as long as some key features remain the same, these would be:

Header:

- `Challenge Start Date:` and `Challenge End Date:`
- Line that starts with `Legend:` and contains [] Brackets with the Completed Symbol first and the Not Completed Symbol second

Body (for each anime):

- 1st Line: Contains [] Brackets with the Completed or Not Completed symbol
- 2nd Line: Contains Link to the Anime
- 3rd Line: Starts with `Start:`

If there is a need for it I can add support for other formats, just create an issue.

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

rename .env.example to .env and fill in the values and then replace `ANILIST_CLIENT_ID` and `ANILIST_CLIENT_SECRET` with the corresponding values from the api client you created.

To get the access token for `ANILIST_API_TOKEN` go to this url and replace `{your-application-id}` with your application id.

```
https://anilist.co/api/v2/oauth/authorize?client_id={your-application-id}&response_type=token
```

## Configuration

```
DEBUG=false
SCHEDULE=0 0 * * *
```

If you want to use it in a container it may be more convenient to set the COMMENTS environment variable than using the comments.json file just add the links to the comments seperated with a `,` it should look like this:

```
COMMENTS=https://anilist.co/forum/thread/59679/comment/2077484,https://anilist.co/forum/thread/61848/comment/2155941
```

You can also use the comments.json file. Just run the script with `npm start` this will create the comments.json file in the root of the directory. Next add the links of the comments you want to update to the array in the file like this:

```
[
    "https://anilist.co/forum/thread/59679/comment/2077484",
    "https://anilist.co/forum/thread/61848/comment/2155941"
]
```

In the .env file you can set `DEBUG` to `true` to see the new comments in the output.

`SCHEDULE` sets when the script should run (except for the first time) the default is every day at midnight see [this](https://crontab.guru/) to help you set the schedule. Leave it blank to run only once.

## Running

run the script with `npm start`
