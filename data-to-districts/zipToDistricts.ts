import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";

// @ts-ignore
import mapshaper from "mapshaper";
import type { FeatureCollection, MultiPolygon } from "geojson";
import type { ZipToDistrictMap } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputFilePath = "./data/zip_to_district.json";

/** Reads and parses a GeoJSON file */
function readGeoJSON(filePath: string): any {
    const fullPath = path.resolve(__dirname, filePath);
    const rawData = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(rawData);
}

/** A map to store zip code to district mappings */
const zipToDistrictMap = new Map<string, ZipToDistrictMap>();

// async function splitZipCodesOnState() {
//     const zipCodesGeoJSON: FeatureCollection = readGeoJSON("./data/zip_codes.geojson");
//     const statesGeoJSON: FeatureCollection = readGeoJSON("../unified-map-gen/data/states.geojson");

//     for (const state of statesGeoJSON.features) {
        
//     }

//     // save to new geojson file
//     const outputGeoJSON = {
//         type: "FeatureCollection",
//         features: Array.from(zipToDistrictMap.values()),
//     };
//     fs.writeFileSync("./data/zip_codes_by_state.geojson", JSON.stringify(outputGeoJSON, null, 4));
//     console.log(`File created: ./data/zip_codes_by_state.geojson`);
// }

async function assignTractToDistricts() {
    // const csv = fs.readFileSync("./zipToTract.csv", "utf8");
    // const rows = csv.split("\n").map((row) => row.split(",").map(cell => cell.trim().replace(/\r$/, '')));
    // console.log(rows);

    // const tractsGeoJSON: FeatureCollection = readGeoJSON("./data/merged2020Tracts.geojson");
    // const districtsGeoJSON: FeatureCollection = readGeoJSON("./data/merged_districts.geojson");

    const cmd = `
    -i ./data/merged2020Tracts.geojson name=tracts
    -i ./data/merged_districts.geojson name=districts
    -each 'id = StateAbbreviation + "-" + id'
    -join districts calc='overlappedDistricts = collect(id)' target=tracts
    -o ./data/tracts_with_districts.geojson
    `
    await mapshaper.runCommands(cmd);
}

async function assignDistrictsToZipGeoJson() {
    // Use small_zip_codes.geojson for testing instead of zip_codes.geojson
    const cmd = `
    -i ./data/zip_codes.geojson name=zipCodes
    -i ./data/merged_districts.geojson name=districts
    -each 'id = StateAbbreviation + "-" + id'
    -join districts calc='overlappedDistricts = collect(id)' target=zipCodes
    -o ./data/zip_codes_with_districts.geojson
    `
    await mapshaper.runCommands(cmd);

    // fs.writeFileSync(outputFilePath, JSON.stringify(zipToDistrictMap, null, 4));
    // console.log(`File created: ${outputFilePath}`);
}

function convertZipGeoJsonToZipMap() {
    const zipCodesGeoJSON: FeatureCollection = readGeoJSON("./data/zip_codes_with_districts.geojson");
    const districtsGeoJSON: FeatureCollection = readGeoJSON("./data/merged_districts.geojson");
    const zipToDistrictMap: ZipToDistrictMap = {};

    for (const feature of zipCodesGeoJSON.features) {
        let districtsOverlapped = feature.properties?.overlappedDistricts;
        const zipCode = feature.properties?.ZCTA5CE20;

        if (!districtsOverlapped || !zipCode) {
            console.log(`Skipping due to missing data`);
            continue;
        }

        if (!Array.isArray(districtsOverlapped)) {
            districtsOverlapped = [districtsOverlapped];
        }

        const districts = districtsOverlapped.map((district: string) => {
            const [state, districtId] = district.split("-");
            return {
                districtId: parseInt(districtId),
                state,
                percentage: 100 / districtsOverlapped.length
            };
        });

        zipToDistrictMap[zipCode] = { districts };
    }

    console.log(zipToDistrictMap);
    return zipToDistrictMap;
}

async function main() {
    assignTractToDistricts();

    // await assignDistrictsToZipGeoJson();
    // const zipToDistrictMap = convertZipGeoJsonToZipMap();
    // fs.writeFileSync(outputFilePath, JSON.stringify(zipToDistrictMap, null, 4));
}

main();
