import { fileURLToPath } from "url";
import * as fs from "fs";
import { getStateAbbrFromName } from "./stateNameToAbbr.ts";

import * as path from "path";
// @ts-ignore
import mapshaper from "mapshaper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDir = path.join(__dirname, "..", "maps");
const statesGeoJsonDir = path.join(__dirname, "data", "states.geojson");
const outputFile = path.join(__dirname, "merged_nyt_districts.geojson");
const dataToDistrictsOutput = path.join(__dirname, "..", "data-to-districts", "data", "merged_districts.geojson");

/** Reads and parses a GeoJSON file */
function readGeoJSON(filePath: string): any {
    const fullPath = path.resolve(__dirname, filePath);
    const rawData = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(rawData);
}

/** Copied type from ../district-allocation/index.ts */
interface ApportionmentResult {
    State: string;
    Population: number;
    Representatives: number;
    Districts: number;
    /** The number of districts by number of representatives */
    DistrictSizes: Record<number, number>;
    /** District population by number of representatives */
    DistrictPopulations: Record<number, number>;
    PopulationPerMember: number;
    AveragePopulationPerDistrict: number;
}

function getStatesWithOnlyOneDistrict(): string[] {
    const apportionmentData: ApportionmentResult[] = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "district-allocation", "apportionment2.json"), "utf-8")
    );

    // Add a new field called StateAbbreviation
    const processedData = apportionmentData.map((state) => {
        const stateAbbreviation = getStateAbbrFromName(state.State);
        return {
            ...state,
            StateAbbreviation: stateAbbreviation
        };
    });

    const statesWithOnlyOneDistrict = processedData
        .filter((state) => state.Districts === 1)
        .map((state) => state.StateAbbreviation);

    return statesWithOnlyOneDistrict;
}

/** Takes a GeoJSON of all states and filters those out that have more than 1 district */
async function generateEmptyStatesGeoJSON(statesWithOnlyOneDistrict: string[]) {
    const statesGeoJSON = readGeoJSON(statesGeoJsonDir);
    // Filter featuers in statesGeoJSON that are in statesWithOnlyOneDistrict
    const filteredFeatures = statesGeoJSON.features.filter(
        (feature: any) => statesWithOnlyOneDistrict.includes(feature.properties.STUSPS)
    );

    // Rename STUSPS to StateAbbreviation
    for (const feature of filteredFeatures) {
        feature.properties.StateAbbreviation = feature.properties.STUSPS;
        delete feature.properties.STUSPS;
        feature.properties.id = 1;
    }

    const featureCollection = {
        type: "FeatureCollection",
        features: filteredFeatures
    };

    // Write the filtered features to a new GeoJSON file
    fs.writeFileSync(
        path.join(__dirname, "data", "states_with_only_one_district.geojson"),
        JSON.stringify(featureCollection)
    );
}

async function mergeGeoJSONFiles(outputFile: string, simplify: boolean) {
    const files = fs.readdirSync(inputDir);
    const geoJSONFiles = files.filter((file) => file.endsWith(".geojson"));

    for (const file of geoJSONFiles) {
        const fileName = file.split(".")[0];
        const stateAbbreviation = fileName.split(" ")[1];

        // Open the file and add the state abbreviation to each feature
        const geoJSON = readGeoJSON(path.join(inputDir, file));
        for (const feature of geoJSON.features) {
            feature.properties.StateAbbreviation = stateAbbreviation;
        }

        fs.writeFileSync(path.join(inputDir, file), JSON.stringify(geoJSON));
    }

    const inputFiles = geoJSONFiles.map((file) => `"${path.join(inputDir, file)}"`);
    inputFiles.push(`"${path.join(__dirname, "data", "states_with_only_one_district.geojson")}"`);
    const cmd = `${inputFiles.join(" ")} combine-files -merge-layers force -filter-fields StateAbbreviation,Pop20,id ${
        simplify ? "-simplify 0.5" : ""
    } -o "${outputFile}" format=geojson`;

    await mapshaper.runCommands(cmd);
    console.log(`Merged ${geoJSONFiles.length} GeoJSON files into ${outputFile}`);
}

async function main() {
    const statesWithOnlyOneDistrict = getStatesWithOnlyOneDistrict();
    await generateEmptyStatesGeoJSON(statesWithOnlyOneDistrict);

    mergeGeoJSONFiles(outputFile, true);
    // For the data-to-districts map, we shouldn't simplify
    mergeGeoJSONFiles(dataToDistrictsOutput, false);
}

main();
