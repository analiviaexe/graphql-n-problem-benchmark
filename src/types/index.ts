import DataLoader from 'dataloader';

export interface TitleRow {
  tconst: string;
  title_type: string | null;
  primary_title: string;
  original_title: string | null;
  is_adult: boolean | null;
  start_year: number | null;
  end_year: number | null;
  runtime_minutes: number | null;
  genres: string | null;
}

export interface RatingRow {
  tconst: string;
  average_rating: number | null;
  num_votes: number | null;
}

export interface PrincipalRow {
  tconst: string;
  ordering: number;
  nconst: string;
  category: string | null;
  job: string | null;
  characters: string | null;
}

export interface NameRow {
  nconst: string;
  primary_name: string;
  birth_year: number | null;
  death_year: number | null;
  primary_profession: string | null;
}

export interface DataLoaders {
  ratingLoader: DataLoader<string, RatingRow | null>;
  principalsLoader: DataLoader<string, PrincipalRow[]>;
  nameLoader: DataLoader<string, NameRow | null>;
  knownForTitlesLoader: DataLoader<string, TitleRow[]>;
}

export interface GraphQLContext {
  loaders?: DataLoaders;
}
