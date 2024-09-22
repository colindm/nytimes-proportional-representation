/** Opens a CSV file and adds a column for the district that each respondent is in */
import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { DistrictWeight, Party, RespondentRow, ZipToDistrictMap } from "./types";
import { getStateNameFromAbbr } from "./stateAbbrToName";
import { getStateAbbrFromName } from "./stateNameToAbbt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawRespondentData = path.join(__dirname, "data", "df_parties.csv");
const respondentDataWithDistricts = path.join(__dirname, "data", "df_parties_districts.json");

function getNumberOfDistricts(stateAbbreviation: string) {
    const apportionment: ApportionmentResult[] = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "district-allocation", "apportionment2.json"), "utf-8")
    );
    const stateApportionmentInfo = apportionment.find((d: ApportionmentResult) => getStateAbbrFromName(d.State) === stateAbbreviation);
    if (!stateApportionmentInfo) {
        return null;
    }
    return stateApportionmentInfo.Districts;
}

function generateSurveyDataWithDistricts() {
    const data = fs.readFileSync(rawRespondentData, "utf8");
    const parsedData: RespondentRow[] = parse(data, { columns: true });

    const zipToDistrictMap: ZipToDistrictMap = JSON.parse(
        fs.readFileSync(path.join(__dirname, "data", "zip_to_district_map.json"), "utf8")
    );

    let numDistrictsWithoutZip = 0;
    let numDistrictsWithZip = 0;
    for (const row of parsedData) {
        let state = row.state;
        if (state === "") {
            // First two characters of congress_district
            state = row.congress_district.slice(0, 2);
            if (state === "") {
                console.log('no state: ', row)
                continue;
            }
        }


        const numDistricts = getNumberOfDistricts(state);
        if (numDistricts === 1) {
            row.districtWeights = [{
                districtId: 1,
                state: row.state,
                percentage: 100
            }];
            numDistrictsWithZip++;
            continue;
        }

        const zipToDistrictItems = zipToDistrictMap[row.zip];
        if (!zipToDistrictItems) {
            numDistrictsWithoutZip++;
            continue;
        }
        numDistrictsWithZip++;
        row.districtWeights = zipToDistrictItems.districts;
    }

    console.log(`Num districts without zip: ${numDistrictsWithoutZip}`);
    console.log(`Num districts with zip: ${numDistrictsWithZip}`);

    const outputData = JSON.stringify(parsedData);
    fs.writeFileSync(respondentDataWithDistricts, outputData);
}

function getDistrictCode(stateAbbreviation: string, districtId: string | number) {
    if (typeof districtId === "number") {
        return stateAbbreviation + "-" + districtId.toString();
    }
    return stateAbbreviation + "-" + districtId;
}

interface ApportionmentResult {
    State: string;
    Districts: number;
    DistrictSizes: Record<number, number>;
    DistrictPopulations: Record<number, number>;
}

function getNumberOfReps(
    stateAbbreviation: string,
    districtId: string | number,
    districtsGeoJson: GeoJSON.FeatureCollection
) {
    const districtGeoJsonFeature = districtsGeoJson.features.filter(feature => 
        feature.properties?.StateAbbreviation === stateAbbreviation && 
        feature.properties?.id === parseInt(districtId as string)
    )[0];    
    if (!districtGeoJsonFeature) {
        throw new Error(`District not found for ${stateAbbreviation}-${districtId}`);
    }
    const districtPop = districtGeoJsonFeature.properties?.Pop20;

    const apportionment = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "district-allocation", "apportionment2.json"), "utf-8")
    );

    const fullStateName = getStateNameFromAbbr(stateAbbreviation);
    const stateApportionmentInfo = apportionment.find((d: ApportionmentResult) => d.State === fullStateName);

    const districtSizes = stateApportionmentInfo.DistrictSizes;
    if (Object.keys(districtSizes).length < 2) {
        return Object.keys(stateApportionmentInfo.DistrictSizes)[0];
    }
    if (!districtPop) {
        throw new Error ("Population not found for district")
    }

    // find the item in the district population item that is closest to districtPop
    const districtPopulations = stateApportionmentInfo.DistrictPopulations;
    const districtPopulationValues: any = Object.values(districtPopulations);
    const closestDistrictPopulation = districtPopulationValues.reduce((prev: any, curr: any) => {
        return (Math.abs(curr - districtPop) < Math.abs(prev - districtPop) ? curr : prev);
    });

    // Find out if it's the smaller or larger district population number in the district population item
    // Find out if the closestDistrictPopulation is the smaller or larger of the district populations
    const smallestPopulation = Math.min(...districtPopulationValues);
    const largestPopulation = Math.max(...districtPopulationValues);
    const isSmaller = Math.abs(closestDistrictPopulation - smallestPopulation) < Math.abs(closestDistrictPopulation - largestPopulation);

    const districtSizeOptions = Object.keys(districtSizes).map(Number).sort((a, b) => a - b);
    const districtSizeOptionToUse = isSmaller ? districtSizeOptions[0] : districtSizeOptions[districtSizeOptions.length - 1];

    if (fullStateName === "Arizona") {
        console.log(fullStateName, districtPop, isSmaller, districtSizeOptions, districtSizeOptionToUse);
    }

    return districtSizeOptionToUse;
}

function generateDistrictPartyTotals() {
    const data = fs.readFileSync(respondentDataWithDistricts, "utf8");
    const parsedData: RespondentRow[] = JSON.parse(data);
    const districts = fs.readFileSync(path.join(__dirname, "data", "merged_districts.geojson"), "utf8");
    const parsedDistricts: GeoJSON.FeatureCollection = JSON.parse(districts);

    // Order districts in alphabetical order
    const sortedDistricts = parsedDistricts.features.sort((a, b) =>
        a.properties?.StateAbbreviation.localeCompare(b.properties?.StateAbbreviation)
    );

    const districtPartyTotals: Record<
        string,
        {
            [key in Party]: number;
        }
    > = {};

    let totalVotes = 0;
    for (const district of sortedDistricts) {
        const districtUniqueId = getDistrictCode(district.properties?.StateAbbreviation, district.properties?.id);
        districtPartyTotals[districtUniqueId] = {
            progressive: 0,
            new_liberal: 0,
            american_labor: 0,
            growth_and_opp: 0,
            patriot: 0,
            christian_conservative: 0
        };
        const stateAbbreviation = district.properties?.StateAbbreviation;
        if (!stateAbbreviation) throw new Error("State abbreviation not found");

        let rowsWithoutDistrictWeights = 0;
        for (const row of parsedData) {
            // 2800ish rows without district weights (no zip code found)
            if (!row.districtWeights) {
                // console.log(row);
                rowsWithoutDistrictWeights++;
                continue;
            }
            const districtCodes: string[] = row.districtWeights.map((district) =>
                getDistrictCode(district.state, district.districtId)
            );

            // If the respondent is not in the district
            if (!districtCodes.includes(districtUniqueId)) continue;

            for (const districtWeightItem of row.districtWeights) {
                if (districtWeightItem.districtId !== district.properties?.id) continue;
                const party = row.assigned_party as Party;
                let numberOfVotesToAdd = districtWeightItem.percentage;
                // if the percentage is 100, then we need to add 1 vote
                if (districtWeightItem.percentage === 100) {
                    numberOfVotesToAdd = 1;
                }
                districtPartyTotals[districtUniqueId][party] += numberOfVotesToAdd;
                totalVotes += numberOfVotesToAdd;
            }
        }
    }
    console.log("Total votes: ", totalVotes);

    // Convert it to a CSV where each district and party combo is a row with the count
    const csvRows = Object.entries(districtPartyTotals).flatMap(([district, parties]) => {
        const numberOfReps = getNumberOfReps(district.split("-")[0], district.split("-")[1], parsedDistricts);
        return Object.entries(parties).map(([party, count]) => ({ district, numberOfReps, party, count }));
    });

    const csvData = stringify(csvRows, { header: true });
    fs.writeFileSync(path.join(__dirname, "data", "district_party_totals.csv"), csvData);
}

function readFirstRowsOfPartyTotals() {
    const data = fs.readFileSync(path.join(__dirname, "data", "df_parties_districts.json"), "utf8");
    const parsedData: RespondentRow[] = JSON.parse(data);
    // Only read district weights
    const districtWeights = parsedData.map(row => row.districtWeights);
    console.log(parsedData.slice(0, 100));
}

function main() {
    // generateSurveyDataWithDistricts();
    generateDistrictPartyTotals();
    // readFirstRowsOfPartyTotals();
}

main();
