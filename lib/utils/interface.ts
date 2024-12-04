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
