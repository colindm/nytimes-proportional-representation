import { readFileSync, existsSync, readdirSync } from 'fs';
import * as path from 'path';

interface ApportionmentResult {
    State: string;
    Districts: number;
    DistrictSizes: Record<number, number>;
    DistrictPopulations: Record<number, number>;
}

// State name to abbreviation mapping
const stateAbbreviations: { [key: string]: string } = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

// Read the apportionment JSON file
const apportionmentData: ApportionmentResult[] = JSON.parse(
    readFileSync('./apportionment2.json', 'utf-8')
);

// Directory containing the GeoJSON files
const mapsDir = path.join(__dirname, '..', 'maps');

// Function to check if a population is within 0.1% margin of error
function isWithinMargin(actual: number, expected: number): boolean {
    const margin = expected * 0.001; // 0.1% margin
    return Math.abs(actual - expected) <= margin;
}

// Function to count features and check populations in a GeoJSON file
function verifyGeoJSONDistricts(filePath: string, expectedDistricts: ApportionmentResult): {
    featureCount: number;
    populationCounts: Record<number, number>;
} {
    const geoJSON = JSON.parse(readFileSync(filePath, 'utf-8'));
    const populationCounts: Record<number, number> = {};

    geoJSON.features.forEach((feature: any) => {
        const population = parseInt(feature.properties.Pop20, 10);
        populationCounts[population] = (populationCounts[population] || 0) + 1;
    });

    return {
        featureCount: geoJSON.features.length,
        populationCounts
    };
}

// Verify districts for each state
for (const state of apportionmentData) {
    if (state.State === 'Total') continue; // Skip the total row

    const stateAbbr = stateAbbreviations[state.State];
    if (!stateAbbr) {
        console.error(`${state.State}: No abbreviation found`);
        continue;
    }

    const stateFileName = `NYT ${stateAbbr}.geojson`;
    const geoJSONPath = path.join(mapsDir, stateFileName);

    try {
        const { featureCount, populationCounts } = verifyGeoJSONDistricts(geoJSONPath, state);
        
        if (featureCount === state.Districts) {
            console.log(`${state.State} (${stateAbbr}): OK (${featureCount} districts)`);
        } else {
            console.error(`${state.State} (${stateAbbr}): Mismatch - JSON: ${state.Districts}, GeoJSON: ${featureCount}`);
        }

        // Check population counts
        let populationMismatch = false;
        for (const [size, count] of Object.entries(state.DistrictSizes)) {
            const expectedPopulation = state.DistrictPopulations[parseInt(size)];
            let matchingCount = 0;
            
            for (const [actualPop, actualCount] of Object.entries(populationCounts)) {
                if (isWithinMargin(parseInt(actualPop), expectedPopulation)) {
                    matchingCount += actualCount;
                }
            }

            if (matchingCount !== count) {
                console.error(`${state.State} (${stateAbbr}): Population mismatch for ${size}-member districts - Expected: ${count}, Actual: ${matchingCount}`);
                populationMismatch = true;
            }
        }

        if (!populationMismatch) {
            console.log(`${state.State} (${stateAbbr}): Population counts OK`);
        }
    } catch (error) {
        // console.error(`${state.State} (${stateAbbr}): Error reading GeoJSON file - ${error + geoJSONPath}`);
    }
}