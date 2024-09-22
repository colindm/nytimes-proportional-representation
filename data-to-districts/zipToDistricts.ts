import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";

// @ts-ignore
import mapshaper from "mapshaper";
import type { DistrictWeight, ZipToDistrictMap } from "./types";

const DEBUG = false;

const STATES_TO_IGNORE = ["PR", "VI", "GU", "MP", "AS", "DC"];

function readGeoJSON(filePath: string): any {
    const fullPath = path.resolve(__dirname, filePath);
    const rawData = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(rawData);
}

/** Splits zip codes by state and makes a new field for which districts they are in  */
async function generateZipsByState() {
    // https://github.com/mbloch/mapshaper/issues/353
    const cmd = `
    -i ../unified-map-gen/data/states.geojson name=states
    -i ./data/${DEBUG ? "small_" : ""}zip_codes.geojson name=zipCodes
    -merge-layers name=merged target=zipCodes,states force
    -mosaic name=mosaic target=merged
    -i ./data/${DEBUG ? "small_" : ""}zip_codes.geojson name=zipCodes
    -i ../unified-map-gen/data/states.geojson name=states
    -join zipCodes target=mosaic fields=ZCTA5CE20
    -join states target=mosaic fields=STUSPS
    -rename-fields StateAbbreviation=STUSPS,ZipCode=ZCTA5CE20
    -filter 'ZipCode!==null'
    -filter 'StateAbbreviation!==null'
    -each zipId=StateAbbreviation+ZipCode
    -i ./data/merged_districts.geojson name=districts
    -each 'id = StateAbbreviation + id'
    -join districts calc='overlappedDistricts = collect(id)' target=mosaic
    -o ./data/zip_by_state_and_district.geojson target=mosaic
    `;
    await mapshaper.runCommands(cmd);
    console.log("Finished Mapshaper Cmd");
}

// TODO: Remove errors allocating ZIPS to multiple districts
// TODO: Generate list of ZIPS in one district and those in multiple districts

/** Fixes errors where ZIPS were allocated to districts in different states */
async function processZipsGeojson() {
    const zipToDistrictMap = new Map<string, ZipToDistrictMap>();
    const zipsGeojson = readGeoJSON("./data/zip_by_state_and_district.geojson");

    // Iterate through the geojson and for each feature, check if the zip code is entirely within one district
    for (const feature of zipsGeojson.features) {
        const state = feature.properties.StateAbbreviation;
        if (STATES_TO_IGNORE.includes(state)) {
            delete feature.geometry;
            delete feature.properties;
            continue;
        }
        const zip = feature.properties.ZipCode;
        const districts = feature.properties?.overlappedDistricts;

        // TODO: Investigate these!
        if (!districts) {
            console.log("No districts for zip", zip, "in", state);
            continue;
        }

        // Remove districts that don't start with the state
        const stateDistricts = districts.filter((district: string) => district.startsWith(state));
        feature.properties.overlappedDistricts = stateDistricts;
    }
    fs.writeFileSync("./data/zip_by_state_and_district.geojson", JSON.stringify(zipsGeojson));
    return zipToDistrictMap;
}

/** Generates Zip To District map for ZIPS that are entirely within one district */
async function initalizeZipToDistrictMap() {
    // Read the geojson
    const zipsGeojson = readGeoJSON("./data/zip_by_state_and_district.geojson");
    const zipToDistrictMap: ZipToDistrictMap = {};

    // Iterate through the geojson and for each feature, check if the zip code is entirely within one district
    for (const feature of zipsGeojson.features) {
        if (!feature.properties) {
            continue;
        }
        if (!feature.properties?.overlappedDistricts) {
            console.log("No districts for zip", feature.properties.ZipCode, "in", feature.properties.StateAbbreviation);
            delete feature.geometry;
            delete feature.properties;
            continue;
        }
        const numDistricts = feature.properties.overlappedDistricts.length;
        if (numDistricts === 1) {
            const zip = feature.properties.ZipCode;
            const district = feature.properties.overlappedDistricts[0];
            const mapObject: DistrictWeight = {
                districtId: parseInt(district.slice(2)),
                state: feature.properties.StateAbbreviation,
                percentage: 100
            };
            zipToDistrictMap[zip] = { districts: [mapObject] };

            // Remove the feature from the geojson
            delete feature.geometry;
            delete feature.properties;
        }
    }
    fs.writeFileSync("./data/zip_to_district_map.json", JSON.stringify(zipToDistrictMap, null, 4));

    zipsGeojson.features = zipsGeojson.features.filter((feature: any) => feature.properties && feature.geometry);

    // Split the GeoJSON into different files based on the StateAbbreviation
    const stateToZips: { [key: string]: any[] } = {};
    for (const feature of zipsGeojson.features) {
        const state = feature.properties.StateAbbreviation;
        if (!stateToZips[state]) {
            stateToZips[state] = [];
        }
        stateToZips[state].push(feature);
    }

    // Write separate GeoJSON files for each state
    for (const [state, features] of Object.entries(stateToZips)) {
        const stateGeoJSON = {
            type: "FeatureCollection",
            features: features
        };
        const outputPath = `./data/split_zips/${state}.geojson`;
        if (!fs.existsSync("./data/split_zips")) {
            fs.mkdirSync("./data/split_zips");
        }
        fs.writeFileSync(outputPath, JSON.stringify(stateGeoJSON, null, 2));
        console.log(`Written ${state} split zips to ${outputPath}`);
    }
}

async function addPopulationToZips() {
    // For all the files in ./data/split_zips
    const files = fs.readdirSync("./data/split_zips");
    const zipToDistrictMap = readGeoJSON("./data/zip_to_district_map.json");

    for (const file of files) {
        if (file.endsWith("_aggregated.geojson")) {
            continue;
        }
        const state = file.split(".")[0];
        if (state === "" || !state || state === null || state === "aggregated") continue;
        console.log("Processing state", state);
        // if (state !== "IN") continue;
        const zipsGeojson = `./data/split_zips/${file}`;
        const blocksGeojson = `/Volumes/Frug/maps2/${state}/input/2020Blocks.geojson`;

        // Adds a field to blocks with the zip code and district it's in
        // Then it creates aggregates blocks together by zip code and district
        const cmd = `
        -i ${zipsGeojson} name=zips
        -i ${blocksGeojson} name=blocks
        -join zips largest-overlap fields=ZipCode,StateAbbreviation,zipId,overlappedDistricts
        -filter 'ZipCode!==null'
        -i ./data/merged_districts.geojson name=districts
        -join districts target=blocks fields=id
        -rename-fields DistrictId=id
        -dissolve zipId,DistrictId sum-fields=POP20 copy-fields=ZipCode,StateAbbreviation,overlappedDistricts
        -o force ./data/split_zips/${state}_aggregated.geojson target=blocks
        `;
        await mapshaper.runCommands(cmd);

        // Then read the geojson
        const aggregatedGeojson = readGeoJSON(`./data/split_zips/${state}_aggregated.geojson`);

        const zipCodesToProcess: { [key: string]: number } = {};
        for (const feature of aggregatedGeojson.features) {
            const zip = feature.properties.ZipCode;
            const population = feature.properties.POP20;
            zipCodesToProcess[zip] = (zipCodesToProcess[zip] || 0) + population;
        }

        for (const zip of Object.keys(zipCodesToProcess)) {
            const totalPopulation = zipCodesToProcess[zip];
            // Find the features with this zipId
            const features = aggregatedGeojson.features.filter((feature: any) => feature.properties?.ZipCode === zip);

            const matchingZips = zipToDistrictMap[zip];
            if (matchingZips) {
                console.log("Matching ZIPS found for ", zip);
                continue;
            }

            // Add a new entry
            const newDistrictsWeights: DistrictWeight[] = [];
            for (const feature of features) {
                const districtId = feature.properties.DistrictId;
                const districtWeight: DistrictWeight = {
                    districtId: districtId,
                    state: state,
                    percentage: (feature.properties.POP20 / totalPopulation) * 100
                };
                newDistrictsWeights.push(districtWeight);
            }
            zipToDistrictMap[zip] = { districts: newDistrictsWeights };
        }
    }

    fs.writeFileSync("./data/zip_to_district_map.json", JSON.stringify(zipToDistrictMap, null, 4));
}

async function main() {
    // await generateZipsByState();
    // await processZipsGeojson();
    // await initalizeZipToDistrictMap();
    await addPopulationToZips();
}

main();
