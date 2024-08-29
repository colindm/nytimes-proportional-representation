import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import mapshaper from "mapshaper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDir = path.join(__dirname, "..", "maps");
const outputFile = path.join(__dirname, "merged_nyt_districts.geojson");
async function mergeGeoJSONFiles() {
    const files = fs.readdirSync(inputDir);
    const geoJSONFiles = files.filter((file) => file.endsWith(".geojson"));

    const inputFiles = geoJSONFiles.map((file) => `"${path.join(inputDir, file)}"`);
    const cmd = `${inputFiles.join(
        " "
    )} combine-files -each 'this.x=1' -merge-layers force -filter-fields Pop20,id -simplify 0.5 -o "${outputFile}" format=geojson`;

    await mapshaper.runCommands(cmd);
    console.log(`Merged ${geoJSONFiles.length} GeoJSON files into ${outputFile}`);
}

mergeGeoJSONFiles();
