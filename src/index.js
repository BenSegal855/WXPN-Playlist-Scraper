import { setup } from '@skyra/env-utilities';
import axios from 'axios';
import moment from 'moment';
import { MongoClient } from 'mongodb';
import { env } from 'process';
import { titleCase } from 'title-case';

setup();

const pullDate = moment(new Date(env.Start ?? Date.now()));
const DAYS_TO_PULL = parseInt(env.Days ?? '1');
const DIRECTION = env.Direction ?? 'forward';
console.log('Pull Date', pullDate);
console.log('Days', DAYS_TO_PULL);
console.log('Direction', DIRECTION)

if (DIRECTION === 'back') {
	pullDate.add(DAYS_TO_PULL * -1, 'd');
}

const NO_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/d/dc/No_Preview_image_2.png'
let recordNum = 0

console.log('Connecting to Mongo...');
const mongo = new MongoClient(env.Mongo);
const mongoConnect = mongo.connect().then(() => console.log('Mongo Connected!'));

console.log('here we go...');

const dbOps = [];
const allSongs = [];

for(let i = DAYS_TO_PULL; i > 0; i--) {
	console.log(`Getting ${pullDate.format('MMM DD YYYY')}`)

	try {
		const { data: songs } = await axios.get(`https://origin.xpn.org/utils/playlist/json/${pullDate.format('YYYY-MM-DD')}.json`);
		recordNum += songs.length;
		songs.reverse();
		allSongs.push(...songs);
	} catch (e) {
		console.error(`Unable to get ${pullDate.format('MMM DD YYYY')}, Skipping...`);
		console.error(e)
	}
	pullDate.add(1, 'd');
}

console.log(`Getting ${pullDate.format('MMM DD YYYY')} for Duration calc`)
const lastSong = await axios.get(`https://origin.xpn.org/utils/playlist/json/${moment(pullDate).format('YYYY-MM-DD')}.json`)
	.then(({ data }) => data[0]);
allSongs.push(lastSong)

await mongoConnect;
const db = mongo.db(env.DB).collection('Spins');

console.log('Beginning database write!');
for (let idx = 0; idx < recordNum; idx++){
	const currAirDate = allSongs[idx].timeslice ?? allSongs[idx].air_date;
	const nextAirDate = allSongs[idx + 1].timeslice ?? allSongs[idx + 1].air_date;
	if (currAirDate && currAirDate === (allSongs[idx + 1]?.timeslice ?? allSongs[idx + 1]?.air_date)) continue;

	dbOps.push(db.findOneAndReplace({ airDate: currAirDate }, {
		airDate: currAirDate,
		artist: cleaner(allSongs[idx].artist),
		song: cleaner(allSongs[idx].song),
		album: cleaner(allSongs[idx].album),
		estimatedDuration: Math.round((new Date(nextAirDate).getTime() - new Date(currAirDate).getTime()) / 1000),
		image: allSongs[idx].image === '' ?  NO_IMAGE : allSongs[idx].image ?? NO_IMAGE,
		streamPreview: allSongs[idx].streamPreview
	}, { upsert: true }));
}

console.log('Loop exited')
await Promise.all(dbOps)
console.log(`Wrote ${recordNum} records`)
console.log('Done!');
process.exit(0);

/**
 * 
 * @param {string} str 
 * @returns {string} cleaned string
 */
function cleaner(str) {
	str = str.includes('(') && !str.includes(')')	// Add trailing ) is none is present
		? `${str})`
		: str;

	return titleCase(str)				// Title Case
		.replaceAll(/\n|\r|\t/g, ' ')	// Remove all newlines, carriage returns and tabs
		.replaceAll('( ', '(')			// Remove bracket padding
		.replaceAll(' )', ')')			// Remove bracket padding
		.replaceAll(/ +(?= )/g,'')		// Remove consecutive spaces
		.trim();						// Remove leading and trailing whitespace
}