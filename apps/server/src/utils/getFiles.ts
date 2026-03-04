import glob from "glob";
import path from "path";

export const getFiles = (dir: string, ext: string): string[] => {
	const jobsPath = path.join(dir, ext);
	const jobFiles = glob.globSync(jobsPath);
	return jobFiles;
};
