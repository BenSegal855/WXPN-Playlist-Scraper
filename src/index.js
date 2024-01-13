import axios from 'axios';
import moment from 'moment';
import { appendFileSync, writeFileSync } from 'fs';

const pullDate = new Date('2023-12-01');
const DAYS_LEFT = 31;
const NO_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/d/dc/No_Preview_image_2.png'
const FILE_NAME = 'out.txt';
const FILE_SEP = '\t'

const data = [];

writeFileSync(FILE_NAME, ['artist', 'song', 'album', 'timeslice', 'image', 'streamPreview'].join(FILE_SEP) + '\n');

console.log('here we go...')

for(let i = DAYS_LEFT; i > 0; i--) {
	pullDate.setDate(pullDate.getDate() + 1);
	console.log(`Getting ${pullDate.toLocaleDateString()}`)

	try {
		const {data: songs} = await axios.get(`https://origin.xpn.org/utils/playlist/json/${moment(pullDate).format('YYYY-MM-DD')}.json`);
		data.push(...songs);
	
		songs.forEach(song => appendFileSync(FILE_NAME, [
			song.artist,
			song.song,
			song.album,
			song.timeslice,
			song.image === '' ?  NO_IMAGE : song.image ?? NO_IMAGE,
			song.streamPreview
		].join(FILE_SEP) + '\n'));
	} catch (e) {
		console.error(`Unable to get ${pullDate.toLocaleDateString()}, Skipping...`)
	}
}

console.log('Done!');
