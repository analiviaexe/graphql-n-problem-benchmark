export const typeDefs = `#graphql
  type Rating {
    tconst: ID!
    average_rating: Float
    num_votes: Int
  }

  type Name {
    nconst: ID!
    primary_name: String!
    birth_year: Int
    death_year: Int
    primary_profession: String
    known_for_titles: [Title!]!
  }

  type Principal {
    tconst: ID!
    ordering: Int!
    nconst: ID!
    category: String
    job: String
    characters: String
    name: Name
  }

  type Title {
    tconst: ID!
    title_type: String
    primary_title: String!
    original_title: String
    is_adult: Boolean
    start_year: Int
    end_year: Int
    runtime_minutes: Int
    genres: String
    rating: Rating
    principals: [Principal!]!
  }

  type Query {
    getTitles(limit: Int = 50, offset: Int = 0): [Title!]!
    getTitleById(tconst: ID!): Title
  }
`;
