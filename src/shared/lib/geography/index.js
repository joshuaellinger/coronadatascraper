import * as turf from './turf.js';
import usStates from '../../vendor/usa-states.json';

import countryCodes from '../../vendor/country-codes.json';
import countyGeoJSON from '../../vendor/usa-counties.json';
import strippedCountyMap from '../../vendor/usa-countymap-stripped.json';

export { usStates };

const UNASSIGNED = '(unassigned)';

/*
  Override some incorrect country names
*/
const countryMap = {
  Kosovo: 'XKX',
  'Congo (Kinshasa)': 'Congo, Democratic Republic of the',
  "Cote d'Ivoire": "Côte d'Ivoire",
  Russia: 'Russian Federation',
  Vietnam: 'Viet Nam',
  'Korea, South': 'Korea, Republic of',
  'South Korea': 'Korea, Republic of',
  'North Korea': "Korea (Democratic People's Republic of)",
  Brunei: 'Brunei Darussalam',
  Reunion: 'Réunion',
  Curacao: 'Curaçao',
  'United Kingdom': 'GBR',
  'occupied Palestinian territory': 'PSE',
  'Congo (Brazzaville)': 'COG',
  Tanzania: 'TZA',
  'The Bahamas': 'BHS',
  'Gambia, The': 'GMB',
  US: 'USA',
  'Bahamas, The': 'BHS',
  'Cape Verde': 'CPV',
  'East Timor': 'TLS',
  'The Gambia': 'GMB',
  'Republic of the Congo': 'COG',
  Syria: 'SYR',
  Laos: 'LAO'
};

/*
  Given a list of counties and a set of properties, combine the GeoJSON for the counties and slap the properties on it
*/
export function generateMultiCountyFeature(counties, properties) {
  // Collect a list of features and polygons matching the list of counties
  const polygons = [];
  const features = [];
  for (const countyFeature of countyGeoJSON.features) {
    if (counties.indexOf(countyFeature.properties.name) !== -1) {
      features.push(countyFeature.properties.name);
      polygons.push(turf.feature(countyFeature.geometry));
    }
  }

  if (features.length !== counties.length) {
    console.warn(
      '⚠️  ',
      counties.length,
      'counties provided to generateMultiCountyFeature, only',
      features.length,
      'features matched'
    );
  }

  // Generate a combined feature from all of the polygons
  let combinedPolygon = polygons.pop();
  while (polygons.length) {
    combinedPolygon = turf.union(combinedPolygon, polygons.pop());
  }
  const combinedFeature = combinedPolygon;
  combinedFeature.properties = properties;

  // Store each of the locations so we can reference them later and get populatin data
  combinedFeature._aggregatedLocations = features.map(f => {
    const [county, state] = f.split(', ');
    return {
      county,
      state,
      ...properties
    };
  });

  return combinedFeature;
}

export const isCountry = function(location) {
  return location && location.country && !location.state && !location.county && !location.city;
};

export const isState = function(location) {
  return location && location.state && !location.county && !location.city;
};

export const isCounty = function(location) {
  return location && location.county && !location.city;
};

export const isCity = function(location) {
  return location && location.city;
};

export const getLocationGranularityName = function(location) {
  if (isCountry(location)) {
    return 'country';
  }
  if (isState(location)) {
    return 'state';
  }
  if (isCounty(location)) {
    return 'county';
  }
  if (isCity(location)) {
    return 'city';
  }
  return 'none';
};

/*
  Get the full name of a location
*/
export const getName = function(location) {
  let name = '';
  let sep = '';
  if (location.city) {
    name += location.city;
    sep = ', ';
  }
  if (location.county) {
    name += sep + location.county;
    sep = ', ';
  }
  if (location.state) {
    name += sep + location.state;
    sep = ', ';
  }
  if (location.country) {
    name += sep + location.country;
    sep = ', ';
  }
  return name;
};

/*
  Get the priority of a location
*/
export const getPriority = function(location) {
  return location.priority !== undefined ? location.priority : 0;
};

/*
  Normalize the state as a 2-letter string
*/
export const toUSStateAbbreviation = function(string) {
  return usStates[string] || string;
};

/*
  Normalize the state as a 2-letter string
*/
export const toISO3166Alpha3 = function(string) {
  let localString = string;
  localString = countryMap[localString] || localString;
  for (const country of countryCodes) {
    if (
      country['alpha-3'] === localString ||
      country['alpha-2'] === localString ||
      country.name === localString ||
      country.name.replace(/\s*\(.*?\)/, '') === localString ||
      country.name.replace(/, Province of .*$/, '') === localString ||
      country.name.replace(/, Republic of$/, '') === localString
    ) {
      return country['alpha-3'];
    }
  }
  console.warn('⚠️  Could not find country code for', localString);
  return localString;
};

/*
  Append ' County' to the end of a string, if not already present
*/
export const addCounty = function(string) {
  let localString = string;
  if (!localString.match(/ County$/)) {
    localString += ' County';
  }
  return localString;
};

/*
  Add empty regions if they're not defined already
*/
export const addEmptyRegions = function(regionDataArray, regionNameArray, regionGranularity) {
  // Get an object of all the tracked regions
  const trackedRegions = regionDataArray.reduce((a, region) => {
    a[region[regionGranularity]] = true;
    return a;
  }, {});

  for (const regionName of regionNameArray) {
    if (!trackedRegions[regionName]) {
      // Throw an empty region on if not defined
      regionDataArray.push({
        [regionGranularity]: regionName,
        cases: 0
      });
    }
  }
  return regionDataArray;
};

/*
  Calculates active cases from location data
*/
export const getActiveFromLocation = function(location) {
  if (location.cases !== undefined && location.deaths !== undefined && location.recovered !== undefined) {
    return location.cases - location.deaths - location.recovered;
  }
  return undefined;
};

/*
  Return a minimized and stripped county name with no punctuation
*/
export const stripCountyName = function(county) {
  // Strip off country/parish, all punctuation, lowercase
  return county
    .trim()
    .toLowerCase()
    .replace(/[^A-Za-z,]*/g, '')
    .replace(/(parish|county)/, '');
};

/*
  Get a proper state name
*/
export const getState = function(state) {
  return usStates[state] || state;
};

/*
  Get a proper county name
*/
export const getCounty = function(county, state) {
  state = getState(state);

  if (county.match(/city$/)) {
    // These need to be handled on a case-by-case basis
    return county;
  }

  if (county === 'Unknown') {
    // These are cases we can't place in a given county
    return UNASSIGNED;
  }

  // Compare
  const foundCounty = strippedCountyMap[stripCountyName(`${county},${state}`)];
  if (foundCounty) {
    return foundCounty.replace(/, .*$/, '');
  }
  return county;
};
