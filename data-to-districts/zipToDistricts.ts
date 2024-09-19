import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ZipCodeFeature = {
    type: string;
    geometry: {
        type: string;
        coordinates: number[][][];
    };
    properties: {
        /** Zip Code # */
        ZCTA5CE20: string;
    };
}

type DistrictFeature = {
    type: string;
    geometry: {
        type: string;
        coordinates: number[][][];
    };
    properties: {
        /** District ID */
        id: number;
        /** District Population */
        Pop20: number;
    };
}

type FeatureCollection<T extends DistrictFeature | ZipCodeFeature> = {
    type: string;
    features: T[];
}

type ZipToDistrict = {
    zipCode: string;
    state: string;
    districtId: number;
}

/** Reads and parses a GeoJSON file */
function readGeoJSON(filePath: string): any {
    const fullPath = path.resolve(__dirname, filePath);
    const rawData = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(rawData);
}

// Read the zip codes GeoJSON file
const zipCodesGeoJSON: FeatureCollection<ZipCodeFeature> = readGeoJSON('./data/zip_codes.geojson');

// Read the districts GeoJSON file
const districtsGeoJSON: FeatureCollection<DistrictFeature> = readGeoJSON('./merged_districts.geojson');

// Iterate through all the zip 