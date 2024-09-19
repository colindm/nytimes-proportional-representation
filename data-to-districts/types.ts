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