export type DistrictWeight = {
    districtId: number;
    state: string;
    percentage: number;
}

export type ZipToDistrictMap = {
    /** Zip code */
    [key: string]: {
        districts: DistrictWeight[];
    };
};

export type Party = "progressive" | "new_liberal" | "american_labor" | "growth_and_opp" | "patriot" | "christian_conservative";

export type RespondentRow = {
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