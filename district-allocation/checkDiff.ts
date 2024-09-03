/** 
 * Returns states where the number of districts and/or district populations changed between apportionment.json and apportionment2.json
 *  */

import fs from 'fs';

interface StateData {
    State: string;
    Districts: number;
    DistrictPopulations: { [key: string]: number };
}

function compareApportionments(file1: string, file2: string) {
    const data1: StateData[] = JSON.parse(fs.readFileSync(file1, 'utf-8'));
    const data2: StateData[] = JSON.parse(fs.readFileSync(file2, 'utf-8'));

    const changedStates: string[] = [];

    for (let i = 0; i < data1.length; i++) {
        const state1 = data1[i];
        const state2 = data2[i];

        if (state1.State !== state2.State) {
            console.error(`State mismatch at index ${i}: ${state1.State} vs ${state2.State}`);
            continue;
        }

        if (state1.Districts !== state2.Districts || 
            JSON.stringify(state1.DistrictPopulations) !== JSON.stringify(state2.DistrictPopulations)) {
            changedStates.push(state1.State);
        }
    }

    console.log("States with changes in districts or district populations:");
    changedStates.forEach(state => console.log(state));
}

compareApportionments('apportionment.json', 'apportionment2.json');