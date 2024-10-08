# data-to-districts

# zipToDistricts.ts

This script takes a ZIP codes shapefile and generates a JSON file with the ZIP codes and the districts they belong to.

## index.ts

Takes a CSV file with respondent data and adds a column for the district that each respondent is in based on the data generated by zipToDistricts.ts.
The districts are the districts I drew for the NYT proportional representation article.

## Files in /data

**df_parties.csv** - Respondent data

-   Data was collected July 2019-January 2021.
-   Districts described in data are the 2020 election congressional districts.
-   Respondents entered ZIP codes and then the survey company matched the ZIP code to a congressional district based on guessing work (?).

**df_parties_districts.csv** - Respondent data with districts added

**zip_codes.geojson** - GeoJSON file with the 2020 ZIP code boundaries from [here](https://catalog.data.gov/dataset/tiger-line-shapefile-2022-nation-u-s-2020-census-5-digit-zip-code-tabulation-area-zcta5).

**merged_districts.geojson** - GeoJSON file with all the districts I drew for the NYT proportional representation article.

**zip_to_district_map.json** - JSON file with the ZIP codes and the districts they belong to. Generated by zipToDistricts.ts.

**merged2020Tracts.geojson** - GeoJSON file with all 2020 census tracts in one file. This was generated in the shapefile-downloader directory within the census-viz2 repository. If someone other than me is reading this, reach out to me for the file.