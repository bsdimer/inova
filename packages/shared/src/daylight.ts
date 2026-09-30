/**
 * Day or night for the «Динамична» theme (WHI-86, Dima 30.09): sunrise and
 * sunset for the browser's time zone. People and organisations are in
 * different places, so no fixed city; no location permission, no tenant
 * setting. A zone maps to approximate coordinates — its main city is close
 * enough for a theme — and a zone not in the table is light 07:00–19:00
 * local time.
 */

/** [latitude, longitude] in degrees, north and east positive. */
const ZONES: Record<string, readonly [number, number]> = {
  'Europe/Sofia': [42.7, 23.32],
  'Europe/Athens': [37.98, 23.73],
  'Europe/Bucharest': [44.43, 26.1],
  'Europe/Istanbul': [41.01, 28.98],
  'Europe/Belgrade': [44.79, 20.45],
  'Europe/Skopje': [42.0, 21.43],
  'Europe/Tirane': [41.33, 19.82],
  'Europe/Podgorica': [42.44, 19.26],
  'Europe/Sarajevo': [43.86, 18.41],
  'Europe/Zagreb': [45.81, 15.98],
  'Europe/Ljubljana': [46.06, 14.51],
  'Europe/Budapest': [47.5, 19.04],
  'Europe/Vienna': [48.21, 16.37],
  'Europe/Bratislava': [48.15, 17.11],
  'Europe/Prague': [50.08, 14.44],
  'Europe/Warsaw': [52.23, 21.01],
  'Europe/Berlin': [52.52, 13.4],
  'Europe/Amsterdam': [52.37, 4.9],
  'Europe/Brussels': [50.85, 4.35],
  'Europe/Paris': [48.86, 2.35],
  'Europe/Zurich': [47.38, 8.54],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Madrid': [40.42, -3.7],
  'Europe/Lisbon': [38.72, -9.14],
  'Europe/London': [51.51, -0.13],
  'Europe/Dublin': [53.35, -6.26],
  'Europe/Chisinau': [47.01, 28.86],
  'Europe/Kyiv': [50.45, 30.52],
  'Europe/Kiev': [50.45, 30.52],
  'Asia/Nicosia': [35.17, 33.36],
};

/** The hours a zone outside the table is light, local time. */
const FALLBACK_DAY = { from: 7, to: 19 } as const;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
/** Julian date of the Unix epoch. */
const JD_UNIX_EPOCH = 2_440_587.5;
/** Julian date of J2000.0. */
const J2000 = 2_451_545;
/** The sun's disc is up when its centre is 0.833° below the horizon (refraction + radius). */
const HORIZON = -0.833 * RAD;
const OBLIQUITY = 23.4397 * RAD;

/**
 * Whether the sun is up at a point, by the sunrise equation (accurate to a
 * few minutes, plenty for a theme). Beyond the polar circles a day without
 * sunrise or sunset is all night or all day.
 */
export function isDaytimeAt(at: Date, latitude: number, longitude: number): boolean {
  const jd = at.getTime() / DAY_MS + JD_UNIX_EPOCH;
  // The solar noon nearest to `at`: rise and set are within half a day of it.
  const cycle = Math.round(jd - J2000 - 0.0008 + longitude / 360);
  const meanNoon = cycle + 0.0008 - longitude / 360;
  const anomaly = ((357.5291 + 0.98560028 * meanNoon) % 360) * RAD;
  const centre =
    1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly) + 0.0003 * Math.sin(3 * anomaly);
  const eclipticLongitude = ((anomaly / RAD + centre + 180 + 102.9372) % 360) * RAD;
  const transit =
    J2000 + meanNoon + 0.0053 * Math.sin(anomaly) - 0.0069 * Math.sin(2 * eclipticLongitude);
  const declination = Math.asin(Math.sin(eclipticLongitude) * Math.sin(OBLIQUITY));
  const phi = latitude * RAD;
  const cosHourAngle =
    (Math.sin(HORIZON) - Math.sin(phi) * Math.sin(declination)) /
    (Math.cos(phi) * Math.cos(declination));
  if (cosHourAngle > 1) return false; // polar night
  if (cosHourAngle < -1) return true; // polar day
  const halfDay = Math.acos(cosHourAngle) / RAD / 360;
  return jd >= transit - halfDay && jd < transit + halfDay;
}

/** The local hour in a zone; a zone the platform cannot read counts as UTC. */
function localHour(at: Date, timeZone: string): number {
  try {
    const hour = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(at);
    return Number(hour);
  } catch {
    return at.getUTCHours();
  }
}

/** Whether «Динамична» is light at `at` for someone in `timeZone`. */
export function isDaytime(at: Date, timeZone: string): boolean {
  const coordinates = ZONES[timeZone];
  if (coordinates) return isDaytimeAt(at, coordinates[0], coordinates[1]);
  const hour = localHour(at, timeZone);
  return hour >= FALLBACK_DAY.from && hour < FALLBACK_DAY.to;
}
