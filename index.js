const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

function formatDate(date) {
    if (date === null) {
        return '00';
    }

    if (date < 10) {
        return '0' + date;
    }

    return date;
}

async function main() {
    // check if JSON file exists
    if (!fs.existsSync('comments.json')) {
        // if not, create it
        fs.writeFileSync('comments.json', '[]');

        console.log("comments.json file doesn't exist, creating it now");
        console.log('Please add the links to the comments you want to update to the comments.json file and run the script again');
        return;
    }

    // Read the JSON file containing the links to the comments to update
    const links = JSON.parse(fs.readFileSync('comments.json', 'utf8'));

    if (links.length === 0) {
        console.log('Please add the links to the comments you want to update to the comments.json file and run the script again');
        return;
    }

    console.log(`Updating ${links.length} comments...`);

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
                    Authorization: `Bearer ${process.env.ANILIST_API_TOKEN}`,
                },
            }
        ).catch((err) => {
            console.log(err.response.data);
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
                            Authorization: `Bearer ${process.env.ANILIST_API_TOKEN}`,
                        },
                    }
                ).catch((err) => {
                    console.log(err.response.data);
                });

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
        if (process.env.DEBUG == 'true') console.log(newCommentText);
        
        // Make a GraphQL request to edit the comment
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
                    Authorization: `Bearer ${process.env.ANILIST_API_TOKEN}`,
                },
            }
        );
    }
        console.log(`Updated comment ${commentId}`);
    }
    console.log('Done');
}

main();