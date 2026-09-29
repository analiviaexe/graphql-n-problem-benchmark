import DataLoader from 'dataloader';

// Interface das linhas da tabela 'titles' no PostgreSQL
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

// Interface das linhas da tabela 'ratings' no PostgreSQL
export interface RatingRow {
  tconst: string;
  average_rating: number | null;
  num_votes: number | null;
}

// Interface das linhas da tabela 'principals' no PostgreSQL
export interface PrincipalRow {
  tconst: string;
  ordering: number;
  nconst: string;
  category: string | null;
  job: string | null;
  characters: string | null;
}

// Interface das linhas da tabela 'names' no PostgreSQL
export interface NameRow {
  nconst: string;
  primary_name: string;
  birth_year: number | null;
  death_year: number | null;
  primary_profession: string | null;
}

// Interface do mapa de DataLoaders
export interface DataLoaders {
  ratingLoader: DataLoader<string, RatingRow | null>;
  principalsLoader: DataLoader<string, PrincipalRow[]>;
  nameLoader: DataLoader<string, NameRow | null>;
  knownForTitlesLoader: DataLoader<string, TitleRow[]>;
}

// Interface do Contexto do Apollo Server
export interface GraphQLContext {
  loaders?: DataLoaders;
}
