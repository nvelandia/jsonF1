export interface iDriver {
  session_key: number;
  meeting_key: number;
  broadcast_name: string;
  country_code: string;
  first_name: string;
  full_name: string;
  headshot_url: string;
  last_name: string;
  driver_number: number;
  team_colour: string;
  team_name: string;
  name_acronym: string;
}

export interface iPosition {
  session_key: number;
  meeting_key: number;
  driver_number: number;
  date: Date;
  position: number;
}

export type MergedData = iPosition & iDriver;
export type ISessions = ISession[];

export interface ISession {
  location: string;
  country_key: number;
  country_code: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  session_type: string;
  session_name: string;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  session_key: number;
  meeting_key: number;
  year: number;
}

export interface iParams {
  session_key: number;
  match_start: any;
  waitTime1: string;
  waitTime2: string;
}
