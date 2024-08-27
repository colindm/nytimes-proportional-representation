import { readFileSync, writeFileSync } from "fs";
import { parse } from "csv-parse/sync";

interface StateData {
    state: string;
    population: number;
}

interface ApportionmentResult {
    State: string;
    Population: number;
    Representatives: number;
    Districts: number;
    //** The number of districts by number of representatives */
    DistrictSizes: Record<number, number>;
    //** District population by number of representatives */
	DistrictPopulations: Record<number, number>;
	PopulationPerMember: number;
	AveragePopulationPerDistrict: number;
}

const INCLUDE_DC = false;
const INCLUDE_PR = false;
const TOTAL_REPRESENTATIVES = 593;

function calculateDistricts(representatives: number, population: number): [number, Record<number, number>, Record<number, number>] {
    const districts = Math.max(1, Math.round(representatives / 6));
    const sizes = new Array(7).fill(0);
    let remainingReps = representatives;

    for (let i = 0; i < districts; i++) {
        const size = Math.min(Math.round(remainingReps / (districts - i)), 6);
        sizes[size]++;
        remainingReps -= size;
    }

    const sizeObject: Record<number, number> = {};
    const popObject: Record<number, number> = {};
    for (let i = 1; i < sizes.length; i++) {
        if (sizes[i] > 0) {
            sizeObject[i] = sizes[i];
            popObject[i] = Math.round(population * (i * sizes[i] / representatives) / sizes[i]);
        }
    }

    return [districts, sizeObject, popObject];
}

function huntingtonHill(states: StateData[], totalSeats: number): Map<string, number> {
    const apportionment = new Map<string, number>();
    states.forEach((state) => apportionment.set(state.state, 1));
    let remainingSeats = totalSeats - states.length;

    while (remainingSeats > 0) {
        let maxPriority = -Infinity;
        let maxState = "";

        for (const state of states) {
            const currentSeats = apportionment.get(state.state)!;
            const priority = state.population / Math.sqrt(currentSeats * (currentSeats + 1));

            if (priority > maxPriority) {
                maxPriority = priority;
                maxState = state.state;
            }
        }

        apportionment.set(maxState, apportionment.get(maxState)! + 1);
        remainingSeats--;
    }

    return apportionment;
}

// Read and parse the CSV file
const csvData = readFileSync("./statePopulation.csv", "utf-8");
const parsedData: StateData[] = parse(csvData, {
    columns: true,
    skip_empty_lines: true
})
    .map((row: any) => ({
        state: row.State,
        population: parseInt(row.Population.replace(/,/g, ""), 10)
    }))
    .filter((row: any) => INCLUDE_DC || row.state !== "District of Columbia")
    .filter((row: any) => INCLUDE_PR || row.state !== "Puerto Rico");

// Apply Huntington-Hill method
const apportionment = huntingtonHill(parsedData, TOTAL_REPRESENTATIVES);

// Calculate number of districts per state/reps per district and reformat for JSON
const results: ApportionmentResult[] = Array.from(apportionment, ([state, reps]) => {
	const stateData = parsedData.find(data => data.state === state)!;
	const statePopulation = stateData.population;
    const [districts, sizeObject, popObject] = calculateDistricts(reps, statePopulation);

    return {
        State: state,
        Population: statePopulation,
        Representatives: reps,
        Districts: districts,
        DistrictSizes: sizeObject,
		DistrictPopulations: popObject,
		PopulationPerMember: Math.round(statePopulation / reps),
		AveragePopulationPerDistrict: Math.round(statePopulation / districts)
    };
});

// Sort states by number of seats
results.sort((a, b) => b.Representatives - a.Representatives);

const totalReps = results.reduce((acc, curr) => acc + curr.Representatives, 0);
const totalDistricts = results.reduce((acc, curr) => acc + curr.Districts, 0);
const totalPopulation = results.reduce((acc, curr) => acc + curr.Population, 0);

results.push({
    State: "Total",
    Population: totalPopulation,
    Representatives: totalReps,
    Districts: totalDistricts,
    DistrictSizes: {},
	DistrictPopulations: {},
	PopulationPerMember: Math.round(totalPopulation / totalReps),
	AveragePopulationPerDistrict: Math.round(totalPopulation / totalDistricts)
});

// Write the results to a JSON file
const outputJson = JSON.stringify(results, null, 2);
writeFileSync("./apportionment.json", outputJson);

console.log("Apportionment complete. Results written to apportionment.json");
