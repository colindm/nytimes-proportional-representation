/** Opens a CSV file and adds a column for the district that each respondent is in */
import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { DistrictWeight, ZipToDistrictMap } from "./types";
import { getStateNameFromAbbr } from "./stateAbbrToName";

type Party = "progressive" | "new_liberal" | "american_labor" | "growth_and_opp" | "patriot" | "christian_conservative";

type RespondentRow = {
    ResponseId: string;
    response_id: string;
    pid3: number;
    pid7: number;
    pid7_legacy: number;
    foreign_born: number;
    language: number;
    religion: number;
    religion_other_text: string;
    age: number;
    gender: number;
    census_region: number;
    hispanic: number;
    race_ethnicity: number;
    household_income: number;
    education: number;
    zip: string;
    state: string;
    congress_district: string;
    weight: number;
    weight_2020: number;
    weight_both: number;
    assigned_party: Party;

    districtWeights: DistrictWeight[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawRespondentData = path.join(__dirname, "data", "df_parties.csv");
const respondentDataWithDistricts = path.join(__dirname, "data", "df_parties_districts.json");

function generateSurveyDataWithDistricts() {
    const data = fs.readFileSync(rawRespondentData, "utf8");
    const parsedData: RespondentRow[] = parse(data, { columns: true });

    const zipToDistrictMap: ZipToDistrictMap = JSON.parse(
        fs.readFileSync(path.join(__dirname, "data", "zip_to_district.json"), "utf8")
    );

    let numDistrictsWithoutZip = 0;
    let numDistrictsWithZip = 0;
    for (const row of parsedData) {
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

        for (const row of parsedData) {
            // TODO: GET RID OF THIS
            if (!row.districtWeights) continue;
            const districtCodes: string[] = row.districtWeights.map((district) =>
                getDistrictCode(district.state, district.districtId)
            );

            // If the respondent is not in the district
            if (!districtCodes.includes(districtUniqueId)) continue;

            for (const districtWeightItem of row.districtWeights) {
                if (districtWeightItem.districtId !== district.properties?.id) continue;
                const party = row.assigned_party as Party;
                const numberOfVotesToAdd = districtWeightItem.percentage / 100;

                districtPartyTotals[districtUniqueId][party] += numberOfVotesToAdd;
            }
        }
    }

    // Convert it to a CSV where each district and party combo is a row with the count
    const csvRows = Object.entries(districtPartyTotals).flatMap(([district, parties]) => {
        const numberOfReps = getNumberOfReps(district.split("-")[0], district.split("-")[1], parsedDistricts);
        return Object.entries(parties).map(([party, count]) => ({ district, numberOfReps, party, count }));
    });

    const csvData = stringify(csvRows, { header: true });
    fs.writeFileSync(path.join(__dirname, "data", "district_party_totals.csv"), csvData);
}

function main() {
    // generateSurveyDataWithDistricts();
    generateDistrictPartyTotals();
}

main();
