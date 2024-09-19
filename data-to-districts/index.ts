/** Opens a CSV file and adds a column for the district that each respondent is in */
import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

/**"ResponseId","response_id","pid3","pid7","pid7_legacy","foreign_born","language","religion","religion_other_text","age","gender","census_region","hispanic","race_ethnicity","household_income","education","zip","state","congress_district","weight","weight_2020","weight_both","assigned_party"
"R_28CzM4PuJtiOfgV","00100002",1,NA,2,1,3,2,"",37,1,4,1,6,21,8,"91913","CA","CA53",1.75336028820733,NA,NA,"american_labor"
"R_31vCADQS33ae9bL","00100003",1,NA,1,1,3,2,"",45,2,3,1,1,8,7,"40047","KY","KY02",0.144302170760017,NA,NA,"new_liberal" */
interface RespondentRow {
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
    assigned_party: string;

    districtNum?: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, "data", "df_parties.csv");
const outputFile = path.join(__dirname, "data", "df_parties_districts.csv");

const data = fs.readFileSync(inputFile, "utf8");
const parsedData: RespondentRow[] = parse(data, { columns: true });

for (const row of parsedData) {
    row.districtNum = 123;
}

const outputData = stringify(parsedData, { header: true });
fs.writeFileSync(outputFile, outputData);