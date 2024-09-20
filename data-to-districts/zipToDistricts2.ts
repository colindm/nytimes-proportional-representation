import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";

// @ts-ignore
import mapshaper from "mapshaper";

const DEBUG = true;

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
    -each 'id=StateAbbreviation + ZipCode'
    -i ./data/merged_districts.geojson name=districts
    -join districts calc='overlappedDistricts = collect(id)' target=zipCodes
    -o ./data/zip_by_state_and_district.geojson
    `
    await mapshaper.runCommands(cmd);
}

/** Finds which districts each ZIP is withing */
async function getZipsEntirelyInOneDistrict() {
    const cmd = `
    -i ./data/zip_codes.geojson name=zipCodes
    -i ./data/merged_districts.geojson name=districts
    -join zipCodes target=districts fields=ZipCode
    -o ./data/zip_codes_with_districts.geojson
    `
    await mapshaper.runCommands(cmd);
}

async function main() {
    // await getZipsEntirelyInOneDistrict();
    await generateZipsByState();
}

main();