const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const log4js = require('log4js');
const moment = require('moment');
require('dotenv').config();

var logger = log4js.getLogger("Updater");

const ANILIST_API_TOKEN = process.env.ANILIST_API_TOKEN;
const ANILIST_CLIENT_ID = process.env.ANILIST_CLIENT_ID;
const DEBUG = process.env.DEBUG == 'true';
const SCHEDULE = process.env.SCHEDULE;
const COMMENTS = process.env.COMMENTS;

logger.level = DEBUG ? 'debug' : 'info';

// check if tokens are set
function checkTokens() {
    if (!ANILIST_API_TOKEN || ANILIST_API_TOKEN == "your_api_token" || !ANILIST_CLIENT_ID || ANILIST_CLIENT_ID == "your_client_id") {
        logger.error("Please set the needed tokens to autenticate with anilist for more information read the README");
        return false;
    }
    return true;
}

function getComments() {
    if (!COMMENTS) {
        // check if JSON file exists if not, create it
        if (!fs.existsSync('comments.json')) {
            fs.writeFileSync('comments.json', '[]');

            logger.info("comments.json file doesn't exist, creating it now");
            logger.info('Please add the links to the comments you want to update to the comments.json file and run the script again');

            return false;
        }

        return JSON.parse(fs.readFileSync('comments.json', 'utf8'));
    }
    // return the comments from the env variable as an array
    return COMMENTS.split(',');
}

async function main() {

    // Read the JSON file containing the links to the comments to update
    const links = getComments();

    if (!checkTokens()) return;

    if (!links || links.length === 0) {
        logger.error('Please add the links to the comments you want to update to the comments.json file or to the COMMENTS env variable and run the script again');
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
                            createdAt
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
        const createdAtDate = moment(commentResponse.data.data.ThreadComment[0].createdAt * 1000).format('YYYY-MM-DD');

        // Split the comment text into lines
        const lines = commentText.split('\n');

        // Find the line that contains the finish date of the challenge
        const finishDateLine = lines.find((line) => line.startsWith('Challenge Finish Date:'));

        // Extract the finish date from the lines
        const finishDate = finishDateLine.split(': ')[1];

        let finishDateIndex = -1;
        let seriesAmount = 0;
        let finishedSeriesAmount = 0;

        let isNextLine = false;
        let animeId = null;

        // extract Completed and Not Completed Symbols
        const Legend = lines.find((line) => line.startsWith('Legend:'));
        const regex = /\[(.*?)\]/g;
        let matches;
        const symbols = [];

        while ((matches = regex.exec(Legend))) {
            symbols.push(matches[1]);
        }

        const completedSymbol = symbols[0];
        const notCompletedSymbol = symbols[1];

        // Generate the new comment text Lines
        const newLines = [...lines];

        for (let i = 0; i < newLines.length; i++) {
            const line = newLines[i];

            // Check if the line represents an anime on the user's list
            if (line.indexOf('https://anilist.co/anime/') != -1) {
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
                const media = animeResponse.data.data.Media;
                const mediaListEntry = media.mediaListEntry;
                const progress = mediaListEntry.progress;
                const animeEpisodes = media.episodes;

                const startedAt = mediaListEntry.startedAt;
                const completedAt = mediaListEntry.completedAt;

                // extract the start and finish dates from the response data
                const startedAtDate = moment(`${startedAt.year}-${startedAt.month}-${startedAt.day}`, "YYYY-MM-DD");
                const completedAtDate = moment(`${completedAt.year}-${completedAt.month}-${completedAt.day}`, "YYYY-MM-DD");

                // if the start or finish date is invalid, replace it with 0000-00-00
                const seriesStartDate = startedAtDate.isValid() ? startedAtDate.format('YYYY-MM-DD') : '0000-00-00';
                const seriesFinishDate = completedAtDate.isValid() ? completedAtDate.format('YYYY-MM-DD') : '0000-00-00';

                // Replace the line with an updated line containing the anime title and episode count
                let res = `Start: ${seriesStartDate} Finish: ${seriesFinishDate} // Ep: ${progress}/${animeEpisodes}`

                // modify second last line from the current line
                if (progress === animeEpisodes) {
                    newLines[i - 2] = newLines[i - 2].replace(/\[(.*?)\]/g, `[${completedSymbol}]`);
                    finishedSeriesAmount++;
                } else {
                    newLines[i - 2] = newLines[i - 2].replace(/\[(.*?)\]/g, `[${notCompletedSymbol}]`);
                }
                newLines[i] = res;
                seriesAmount++;
            } else if (line.startsWith('Challenge Start Date:')) {
                newLines[i] = `Challenge Start Date: ${createdAtDate}`;
            } else if (line.startsWith('Challenge Finish Date:')) {
                finishDateIndex = i;
            }
        }

        if (!moment(finishDate, "YYYY-MM-DD").isValid() && seriesAmount === finishedSeriesAmount) {
            newLines[finishDateIndex] = `Challenge Finish Date: ${moment().format('YYYY-MM-DD')}`;
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
                    Authorization: `Bearer ${ANILIST_API_TOKEN} `,
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
        logger.info(`Updated comment ${commentId} `);
    }
    logger.info('Done');
}

main();

if (!SCHEDULE) {
    logger.info('No schedule specified, exiting...');
    return;
}

cron.schedule(SCHEDULE, main);