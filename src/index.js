import axios from 'axios';
import moment from 'moment';
import { createWriteStream } from 'fs';
import { env } from 'process';
import { titleCase } from 'title-case';

const pullDate = new Date(env.Start ?? Date.now());
const DAYS_TO_PULL = parseInt(env.Days ?? '1');
console.log('Pull Date', pullDate);
console.log('Days', DAYS_TO_PULL);

const NO_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/d/dc/No_Preview_image_2.png'
const FILE_NAME = `WXPN_${moment(pullDate).format('YYYY-MM-DD')}_${DAYS_TO_PULL}_days.csv`;
const FILE_SEP = '\t'

const data = [];

const file = createWriteStream(FILE_NAME);
const writeDone = new Promise(resolve => file.once('close', resolve));

file.write(['artist', 'song', 'album', 'airDate', 'image', 'streamPreview'].join(FILE_SEP) + '\n');

console.log('here we go...')

for(let i = DAYS_TO_PULL; i > 0; i--) {
	console.log(`Getting ${pullDate.toLocaleDateString()}`)

	try {
		const { data: songs } = await axios.get(`https://origin.xpn.org/utils/playlist/json/${moment(pullDate).format('YYYY-MM-DD')}.json`);
		data.push(...songs);

		songs.forEach((song, idx) => {
			const timeslice = song.timeslice ?? song.air_date;
			if (timeslice && timeslice === (songs[idx + 1]?.timeslice ?? songs[idx + 1]?.air_date)) return;
			file.write([
				cleaner(song.artist),
				cleaner(song.song),
				cleaner(song.album),
				timeslice,
				song.image === '' ?  NO_IMAGE : song.image ?? NO_IMAGE,
				song.streamPreview
			].join(FILE_SEP) + '\n')
		});
	} catch (e) {
		console.error(`Unable to get ${pullDate.toLocaleDateString()}, Skipping...`);
		console.error(e)
	}
	pullDate.setDate(pullDate.getDate() + 1);
}

file.end();

console.log('Loop exited')
await writeDone;

console.log(`Wrote ${data.length} records`)
console.log('Done!');

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