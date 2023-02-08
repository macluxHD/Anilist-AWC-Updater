const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const log4js = require("log4js");
require('dotenv').config();

var logger = log4js.getLogger("Updater");

function formatDate(date) {
    if (date === null) {
        return '00';
    }

    if (date < 10) {
        return '0' + date;
    }

    return date;
}

const ANILIST_API_TOKEN = process.env.ANILIST_API_TOKEN;
const ANILIST_CLIENT_ID = process.env.ANILIST_CLIENT_ID;
const ANILIST_CLIENT_SECRET = process.env.ANILIST_CLIENT_SECRET;
const DEBUG = process.env.DEBUG == 'true';
const SCHEDULE = process.env.SCHEDULE;

logger.level = DEBUG ? 'debug' : 'info';

// check if tokens are set
function checkTokens() {
    if (!ANILIST_API_TOKEN || ANILIST_API_TOKEN == "your_api_token" || !ANILIST_CLIENT_ID || ANILIST_CLIENT_ID == "your_client_id" || !ANILIST_CLIENT_SECRET || ANILIST_CLIENT_SECRET == "your_client_secret") {
        logger.error("Please set the needed tokens to autenticate with anilist for more information read the README");
        return false;
    }
    return true;
}

async function main() {
    // check if JSON file exists
    if (!fs.existsSync('comments.json')) {
        // if not, create it
        fs.writeFileSync('comments.json', '[]');

        logger.info("comments.json file doesn't exist, creating it now");
        logger.info('Please add the links to the comments you want to update to the comments.json file and run the script again');

        checkTokens();
        return;
    }
    if (!checkTokens()) return;

    // Read the JSON file containing the links to the comments to update
    const links = JSON.parse(fs.readFileSync('comments.json', 'utf8'));

    if (links.length === 0) {
        logger.error('Please add the links to the comments you want to update to the comments.json file and run the script again');
        return;
    }

    logger.info(`Updating ${links.length} comments...`);

    for (const link of links) {
        // Extract the comment ID from the link
        const commentId = link.split('/').slice(-1)[0];

        // Make a GraphQL request to retrieve the specified comment
        const commentResponse = await axios.post(
            'https://graphql.anilist.co',
            {
                query: `
                    query($id: Int!) {
                        ThreadComment(id: $id) {
                            comment(asHtml: false)
                        }
                    }
                `,
                variables: {
                    id: commentId,
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ANILIST_API_TOKEN}`,
                },
            }
        ).catch((err) => {
            logger.error(err.response.data);
        });

        // Extract the comment text from the response
        const commentText = commentResponse.data.data.ThreadComment[0].comment;

        // Split the comment text into lines
        const lines = commentText.split('\n');

        // Find the lines that contain the start and finish dates of the challenge
        const startDateLine = lines.find((line) => line.startsWith('Challenge Start Date:'));
        const finishDateLine = lines.find((line) => line.startsWith('Challenge Finish Date:'));

        // Extract the start and finish dates from the lines
        const startDate = startDateLine.split(': ')[1];
        const finishDate = finishDateLine.split(': ')[1];

        var isNextLine = false;
        var animeId = null;

        // Generate the new comment text Lines
        const newLines = [...lines];

        for (let i = 0; i < newLines.length; i++) {
            const line = newLines[i];

            // Check if the line represents an anime on the user's list
            if (line.startsWith('https://anilist.co/anime/')) {
                // Extract the anime ID from the line
                animeId = line.match(/\/anime\/(\d+)\//)[1];
                isNextLine = true;
            } else if (isNextLine && line.startsWith('Start:')) {
                isNextLine = false;
                // Make a GraphQL request to retrieve the specified anime
                const animeResponse = await axios.post(
                    'https://graphql.anilist.co',
                    {
                        query: `
                            query($id: Int!) {
                                Media(id: $id) {
                                    episodes
                                    mediaListEntry {
                                        progress
                                        startedAt {
                                            year
                                            month
                                            day
                                        }
                                        completedAt {
                                            year
                                            month
                                            day
                                        }
                                    }
                                }
                            }
                            `,
                        variables: {
                            id: animeId,
                        },
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${ANILIST_API_TOKEN}`,
                        },
                    }
                ).catch((err) => {
                    logger.error(err.response.data);
                });

                if (!animeResponse) continue;

                // Extract the data from the response
                const Media = animeResponse.data.data.Media;
                const progress = Media.mediaListEntry.progress;
                const animeEpisodes = Media.episodes;

                // extract the start and finish dates from the response data and format them as YYYY-MM-DD and if the date is null, replace it with a 0
                const seriesStartDate = (Media.mediaListEntry.startedAt.year || '0000') + '-' + formatDate(Media.mediaListEntry.startedAt.month) + '-' + formatDate(Media.mediaListEntry.startedAt.day);
                const seriesFinishDate = (Media.mediaListEntry.completedAt.year || '0000') + '-' + formatDate(Media.mediaListEntry.completedAt.month) + '-' + formatDate(Media.mediaListEntry.completedAt.day);

                // Replace the line with an updated line containing the anime title and episode count
                var res = `Start: ${seriesStartDate} Finish: ${seriesFinishDate} // Ep: ${progress}/${animeEpisodes}`

                // modify second last line from the current line
                if (progress === animeEpisodes) {
                    // replace ❌ with  ✅
                    newLines[i - 2] = newLines[i - 2].replace('❌', '✅');
                }
                newLines[i] = res;
            }
        }
        const newCommentText = newLines.join('\n');
        logger.debug(newCommentText);

        // Make a GraphQL request to edit the comment
        const err = '';
        await axios.post(
            'https://graphql.anilist.co',
            {
                query: `
                    mutation($id: Int!, $text: String!) {
                       SaveThreadComment(id: $id, comment: $text) {
                        id
                      }
                    }
                  `,
                variables: {
                    id: commentId,
                    text: newCommentText,
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ANILIST_API_TOKEN}`,
                },
            }
        ).catch((err) => {
            err = err.response.data;
        });;

        if (err != '') {
            logger.error(`Failed to update comment`);
            logger.error(err);
            continue;
        }
        logger.info(`Updated comment ${commentId}`);
    }
    logger.info('Done');
}

main();

if (!SCHEDULE) {
    logger.info('No schedule specified, exiting...');
    return;
}

cron.schedule(SCHEDULE, main);