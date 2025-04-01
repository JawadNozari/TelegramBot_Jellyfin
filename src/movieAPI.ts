import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
const TMDB_API_KEY = process.env.TMDB_API_KEY; // Replace with your API key
const TMDB_API_URL = "https://api.themoviedb.org/3/search";
interface MovieResult {
	id: number;
	title: string;
	release_date?: string;
	// Add other relevant movie properties here
}

interface TVShowResult {
	id: number;
	name: string;
	first_air_date?: string;
	// Add other relevant TV show properties here
}
interface TMDBResponse {
	results: Array<MovieResult | TVShowResult>;
}
type show = {
	title: string;
	season: number;
	episode: number;
};
type movie = { title: string; year: number };
type MediaMetadata = MovieResult | TVShowResult | null;
export async function extractMediaInfo(filename: string) {
	let show: show | undefined = undefined;
	let movie: movie | undefined = undefined;
	const Regex_Shows =
		/^(?<title>.*?)S(?<season>\d{1,2})E(?<episode>\d{2,3}|\d)/i;
	const Regex_Movies = /^(?<title>.+?)\.(?<year>(19|20)\d{2})/i;

	const match_Show = filename.match(Regex_Shows);
	const match_Movie = filename.match(Regex_Movies);
	if (match_Show?.groups) {
		const title = match_Show.groups.title.replace(/[._]/g, " ").trim();
		const season = Number.parseInt(match_Show.groups.season);
		const episode = Number.parseInt(match_Show.groups.episode);
		show = { title, season, episode };
	}
	if (match_Movie?.groups) {
		const title = match_Movie.groups.title.replace(/[._]/g, " ").trim();
		const year = Number.parseInt(match_Movie.groups.year, 10);
		movie = { title, year };
	}
	return [show, movie];
}
export async function getMediaMetadataTMDB(
	fileName: string,
): Promise<MediaMetadata> {
	const [show, movie] = (await extractMediaInfo(fileName)) as [show, movie];

	if (show) {
		const apiUrl = `${TMDB_API_URL}/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(show.title)}&include_adult=false&language=en-US&page=1`;
		const response = await fetch(apiUrl);
		const data = (await response.json()) as TMDBResponse;

		if (
			data.results &&
			Array.isArray(data.results) &&
			data.results.length > 0
		) {
			return data.results[0]; // Return the first result
		}
	}
	if (movie) {
		const apiUrl = `${TMDB_API_URL}/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movie.title)}&year=${movie.year.toString()}`;
		const response = await fetch(apiUrl);
		const data = (await response.json()) as TMDBResponse;

		if (
			data?.results &&
			Array.isArray(data.results) &&
			data.results.length > 0
		) {
			return data.results[0]; // Return the first movie title
		}
	}

	return null;
}
